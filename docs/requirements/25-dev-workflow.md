## Development Workflow

### Setup Instructions (docs/setup-guide.md)

**For Non-Developers:**

1. **Install Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop
   - Install and start Docker Desktop
   - Verify: Open terminal/command prompt, run `docker --version`

2. **Download Family Dashboard**
   - Download ZIP from GitHub
   - Extract to a folder (e.g., `C:\FamilyDashboard`)

3. **Configure Settings**
   - Copy `.env.example` to `.env`
   - Edit `.env` with your API keys (instructions in file)
   - Edit `config/user-settings.json` with your family info

4. **Start Dashboard**
   - Open terminal in dashboard folder
   - Run: `docker-compose up -d`
   - Open browser: http://localhost:3000

5. **First-Time Setup Wizard**
   - Follow on-screen instructions to:
     - Create parent accounts
     - Connect calendars
     - Select photo sources
     - Choose default layout

**For Developers:**

```bash
# Clone repository
git clone https://github.com/yourusername/family-dashboard.git
cd family-dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Set up database
npm run db:setup
npm run db:migrate
npm run db:seed

# Start development server
npm run dev

# Open http://localhost:3000
```

### Docker Deployment

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: family-dashboard
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://familydash:${DB_PASSWORD}@db:5432/familydashboard
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
    volumes:
      - ./config:/app/config
      - ./uploads:/app/uploads
      - photos-cache:/app/cache/photos
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - family-dashboard-network

  db:
    image: postgres:15-alpine
    container_name: family-dashboard-db
    environment:
      - POSTGRES_DB=familydashboard
      - POSTGRES_USER=familydash
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - family-dashboard-network

  redis:
    image: redis:7-alpine
    container_name: family-dashboard-redis
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - family-dashboard-network

volumes:
  postgres-data:
  redis-data:
  photos-cache:

networks:
  family-dashboard-network:
    driver: bridge
```

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js app
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built app
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
```
