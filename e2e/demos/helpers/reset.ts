import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Run SQL against the Prism database via docker exec.
 * Uses a temp file piped to stdin to avoid shell escaping issues on Windows.
 */
function runSQL(sql: string) {
  const tmpFile = join(tmpdir(), `prism-demo-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, 'utf-8');
  try {
    execSync(`docker exec -i prism-db psql -U prism -d prism < "${tmpFile}"`, {
      stdio: 'pipe',
      shell: 'cmd.exe',
    });
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Reset demo-relevant data to seed state via docker exec.
 * Call before each scenario to ensure a clean starting point.
 */
export function resetDemoData() {
  runSQL(`
    UPDATE tasks SET completed = false, completed_at = NULL, completed_by = NULL
      WHERE title != 'Return library books' AND completed = true;
    UPDATE shopping_items SET checked = false;
    DELETE FROM chore_completions WHERE completed_at > now() - interval '1 day';
    DELETE FROM settings WHERE key IN ('awayMode', 'babysitterMode');
    DELETE FROM recipes WHERE name LIKE 'Demo:%';
  `);

  // Flush Redis sessions so login state is clean
  execSync('docker exec prism-redis redis-cli FLUSHDB', { stdio: 'pipe' });
}

/**
 * Seed a test recipe for the recipe demo scenario.
 */
export function seedTestRecipe() {
  runSQL(`
    INSERT INTO recipes (name, description, ingredients, instructions, prep_time, cook_time, servings, cuisine, category, created_by)
    SELECT
      'Demo: Spaghetti Bolognese',
      'A classic Italian meat sauce over pasta',
      '[{"text":"1 lb Spaghetti"},{"text":"1 lb Ground beef"},{"text":"28 oz can Crushed tomatoes"},{"text":"1 Onion, diced"},{"text":"3 Garlic cloves, minced"},{"text":"2 tbsp Olive oil"},{"text":"1 tbsp Italian seasoning"},{"text":"Salt and pepper to taste"}]'::jsonb,
      E'1. Cook spaghetti according to package directions.\\n2. Heat olive oil in a large skillet over medium heat.\\n3. Add onion and cook until softened, about 5 minutes.\\n4. Add garlic and cook 1 minute.\\n5. Add ground beef and brown, breaking into pieces.\\n6. Stir in crushed tomatoes and Italian seasoning.\\n7. Simmer 20 minutes. Season with salt and pepper.\\n8. Serve sauce over spaghetti.',
      10, 30, 4,
      'Italian', 'Dinner',
      (SELECT id FROM users WHERE name = 'Alex' LIMIT 1)
    WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE name = 'Demo: Spaghetti Bolognese');
  `);
}

/**
 * Seed babysitter info entries for the babysitter mode demo.
 */
export function seedBabysitterInfo() {
  runSQL(`
    INSERT INTO babysitter_info (section, sort_order, content, is_sensitive)
    SELECT 'emergency_contact', 0,
      '{"name":"Mom (Jordan)","phone":"(555) 123-4567","relationship":"Parent"}'::jsonb,
      false
    WHERE NOT EXISTS (SELECT 1 FROM babysitter_info WHERE section = 'emergency_contact' LIMIT 1);

    INSERT INTO babysitter_info (section, sort_order, content, is_sensitive)
    SELECT 'emergency_contact', 1,
      '{"name":"Dad (Alex)","phone":"(555) 987-6543","relationship":"Parent"}'::jsonb,
      false
    WHERE NOT EXISTS (SELECT 1 FROM babysitter_info WHERE section = 'emergency_contact' AND sort_order = 1 LIMIT 1);

    INSERT INTO babysitter_info (section, sort_order, content, is_sensitive)
    SELECT 'child_info', 0,
      '{"name":"Emma","age":"11","allergies":"None","bedtime":"8:30 PM","notes":"Loves reading before bed"}'::jsonb,
      false
    WHERE NOT EXISTS (SELECT 1 FROM babysitter_info WHERE section = 'child_info' LIMIT 1);

    INSERT INTO babysitter_info (section, sort_order, content, is_sensitive)
    SELECT 'child_info', 1,
      '{"name":"Sophie","age":"8","allergies":"None","bedtime":"8:00 PM","notes":"Needs a nightlight"}'::jsonb,
      false
    WHERE NOT EXISTS (SELECT 1 FROM babysitter_info WHERE section = 'child_info' AND sort_order = 1 LIMIT 1);

    INSERT INTO babysitter_info (section, sort_order, content, is_sensitive)
    SELECT 'house_rule', 0,
      '{"rule":"No screens after 7 PM"}'::jsonb,
      false
    WHERE NOT EXISTS (SELECT 1 FROM babysitter_info WHERE section = 'house_rule' LIMIT 1);

    INSERT INTO babysitter_info (section, sort_order, content, is_sensitive)
    SELECT 'house_info', 0,
      '{"label":"WiFi Password","value":"prism-family-2024"}'::jsonb,
      true
    WHERE NOT EXISTS (SELECT 1 FROM babysitter_info WHERE section = 'house_info' LIMIT 1);
  `);
}
