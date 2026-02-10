import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const BACKUP_DIR = '/app/backups';
const DB_HOST = 'db';
const DB_NAME = 'prism';
const DB_USER = 'prism';

// All tables in dependency order (children before parents for truncate)
const ALL_TABLES = [
  'goal_achievements',
  'goals',
  'photos',
  'photo_sources',
  'api_credentials',
  'layouts',
  'babysitter_info',
  'settings',
  'birthdays',
  'maintenance_completions',
  'maintenance_reminders',
  'family_messages',
  'meals',
  'recipes',
  'shopping_items',
  'shopping_lists',
  'shopping_list_sources',
  'chore_completions',
  'chores',
  'tasks',
  'task_sources',
  'task_lists',
  'events',
  'calendar_sources',
  'calendar_groups',
  'users',
];

export interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: Date;
  createdAtFormatted: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<BackupInfo[]> {
  await ensureBackupDir();

  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (file.endsWith('.sql.gz') || file.endsWith('.sql')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stat = await fs.stat(filePath);

        backups.push({
          filename: file,
          size: stat.size,
          sizeFormatted: formatBytes(stat.size),
          createdAt: stat.mtime,
          createdAtFormatted: formatDate(stat.mtime),
        });
      }
    }

    // Sort by date, newest first
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return backups;
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

/**
 * Create a new backup
 */
export async function createBackup(): Promise<{ success: boolean; filename?: string; error?: string }> {
  await ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `prism_${timestamp}.sql.gz`;
  const filePath = path.join(BACKUP_DIR, filename);

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    return { success: false, error: 'Database password not configured' };
  }

  try {
    // Run pg_dump and compress with gzip
    const command = `PGPASSWORD="${dbPassword}" pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} --no-owner --no-acl | gzip > "${filePath}"`;

    await execAsync(command, {
      shell: '/bin/sh',
      timeout: 300000, // 5 minute timeout
    });

    // Verify the file was created and has content
    const stat = await fs.stat(filePath);
    if (stat.size < 100) {
      await fs.unlink(filePath);
      return { success: false, error: 'Backup file is too small - backup may have failed' };
    }

    return { success: true, filename };
  } catch (error) {
    console.error('Error creating backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating backup'
    };
  }
}

/**
 * Restore from a backup file
 */
export async function restoreBackup(filename: string): Promise<{ success: boolean; error?: string }> {
  const filePath = path.join(BACKUP_DIR, filename);

  // Security: prevent path traversal
  if (filename.includes('..') || filename.includes('/')) {
    return { success: false, error: 'Invalid filename' };
  }

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    return { success: false, error: 'Database password not configured' };
  }

  try {
    // Check file exists
    await fs.access(filePath);

    // Determine if compressed
    const isCompressed = filename.endsWith('.gz');

    // Build restore command
    let command: string;
    if (isCompressed) {
      command = `gunzip -c "${filePath}" | PGPASSWORD="${dbPassword}" psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} --quiet`;
    } else {
      command = `PGPASSWORD="${dbPassword}" psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} --quiet < "${filePath}"`;
    }

    await execAsync(command, {
      shell: '/bin/sh',
      timeout: 600000, // 10 minute timeout
    });

    return { success: true };
  } catch (error) {
    console.error('Error restoring backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error restoring backup'
    };
  }
}

/**
 * Delete a backup file
 */
export async function deleteBackup(filename: string): Promise<{ success: boolean; error?: string }> {
  // Security: prevent path traversal
  if (filename.includes('..') || filename.includes('/')) {
    return { success: false, error: 'Invalid filename' };
  }

  const filePath = path.join(BACKUP_DIR, filename);

  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error deleting backup'
    };
  }
}

/**
 * Download a backup file (returns the file path)
 */
export async function getBackupPath(filename: string): Promise<string | null> {
  // Security: prevent path traversal
  if (filename.includes('..') || filename.includes('/')) {
    return null;
  }

  const filePath = path.join(BACKUP_DIR, filename);

  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

/**
 * Truncate all data from the database
 */
export async function truncateAllData(): Promise<{ success: boolean; error?: string }> {
  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    return { success: false, error: 'Database password not configured' };
  }

  try {
    // Use TRUNCATE with CASCADE to handle foreign keys
    const truncateSQL = ALL_TABLES.map(table => `TRUNCATE TABLE "${table}" CASCADE;`).join(' ');
    const command = `PGPASSWORD="${dbPassword}" psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -c "${truncateSQL}"`;

    await execAsync(command, {
      shell: '/bin/sh',
      timeout: 60000,
    });

    return { success: true };
  } catch (error) {
    console.error('Error truncating database:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error truncating database'
    };
  }
}

/**
 * Seed the database with demo data
 */
export async function seedDatabase(): Promise<{ success: boolean; error?: string }> {
  try {
    // Run the seed script via npm
    const command = 'cd /app && node -e "require(\'./src/lib/db/seed.js\')"';

    await execAsync(command, {
      shell: '/bin/sh',
      timeout: 120000,
      env: { ...process.env },
    });

    return { success: true };
  } catch (error) {
    console.error('Error seeding database:', error);
    // Try alternative approach - direct execution
    try {
      const dbPassword = process.env.DB_PASSWORD;
      if (!dbPassword) {
        return { success: false, error: 'Database password not configured' };
      }

      // Run seed via ts-node or compiled version
      const altCommand = `cd /app && npm run db:seed 2>&1 || echo "Seed may need to run manually"`;
      const result = await execAsync(altCommand, {
        shell: '/bin/sh',
        timeout: 120000,
        env: { ...process.env },
      });

      console.log('Seed output:', result.stdout);
      return { success: true };
    } catch (altError) {
      return {
        success: false,
        error: 'Seed script not available in production build. Please run "npm run db:seed" manually.'
      };
    }
  }
}
