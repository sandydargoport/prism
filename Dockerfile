# ============================================================================
# PRISM - Family Dashboard
# Dockerfile - Container Build Instructions
# ============================================================================
#
# WHAT THIS FILE DOES:
# A Dockerfile is like a recipe for creating a Docker image. It tells Docker
# exactly how to set up an environment to run your application, step by step.
#
# HOW DOCKER IMAGES WORK:
# Think of a Docker image as a snapshot of a computer with everything your
# app needs pre-installed. This Dockerfile creates that snapshot.
#
# MULTI-STAGE BUILD:
# This Dockerfile uses a "multi-stage build" pattern:
#   1. Stage 1 (builder): Install dependencies and build the app
#   2. Stage 2 (runner):  Copy only what's needed to run the app
#
# This results in a smaller, more secure final image because build tools
# and development dependencies aren't included in production.
#
# ============================================================================

# ============================================================================
# STAGE 1: DEPENDENCIES
# ============================================================================
# This stage installs all Node.js dependencies.
# We do this in a separate stage so Docker can cache the dependencies layer.
# If your code changes but package.json doesn't, Docker reuses cached deps.
# ============================================================================
FROM node:20-alpine AS deps

# EXPLANATION: Why Alpine?
# Alpine Linux is a minimal Linux distribution (~5MB vs ~1GB for Ubuntu).
# Smaller image = faster downloads, less storage, smaller attack surface.

# Set the working directory inside the container
# All subsequent commands run from this directory
WORKDIR /app

# Install system dependencies needed for some npm packages
# - libc6-compat: Required for some native Node.js modules
RUN apk add --no-cache libc6-compat

# Copy package files FIRST (before other source code)
# Docker caches each layer, so if package.json hasn't changed,
# Docker reuses the cached node_modules from a previous build
COPY package.json package-lock.json* ./

# Install dependencies
# --frozen-lockfile ensures exact versions from lock file are used
# This prevents "works on my machine" issues
RUN npm ci --frozen-lockfile

# ============================================================================
# STAGE 2: BUILDER
# ============================================================================
# This stage builds the Next.js application for production.
# It compiles TypeScript, optimizes code, and creates static assets.
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from the deps stage
# This is faster than installing again
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code
COPY . .

# ENVIRONMENT VARIABLE for build
# NEXT_TELEMETRY_DISABLED: Opt out of Next.js anonymous telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
# This compiles TypeScript, optimizes images, and creates production bundles
# Output goes to .next/ directory
RUN npm run build

# ============================================================================
# STAGE 3: RUNNER (Production Image)
# ============================================================================
# This is the final, minimal image that will actually run in production.
# It contains only what's needed to serve the application - no build tools,
# no dev dependencies, no source code (only compiled output).
# ============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# SECURITY: Run as non-root user
# By default, containers run as root, which is a security risk.
# If an attacker compromises the app, they get root access to the container.
# Running as a limited user ("nextjs") reduces this risk.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user and group
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application from builder stage
# We only copy what's needed to run the app:

# 1. Public assets (images, fonts, etc.)
COPY --from=builder /app/public ./public

# 2. Next.js standalone output (includes server and dependencies)
# The standalone output is a minimal Node.js server with only production deps
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 3. Static files generated during build (JS, CSS bundles)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create directories for runtime data
# These will be mounted as volumes in docker-compose.yml
RUN mkdir -p /app/config /app/uploads /app/cache/photos
RUN chown -R nextjs:nodejs /app/config /app/uploads /app/cache

# Switch to non-root user
USER nextjs

# EXPOSE tells Docker that the container listens on this port
# It's documentation - you still need port mapping in docker-compose.yml
EXPOSE 3000

# Set the port environment variable
ENV PORT=3000
# Hostname 0.0.0.0 allows connections from outside the container
ENV HOSTNAME="0.0.0.0"

# HEALTHCHECK instruction for container health monitoring
# Docker and orchestration tools use this to know if the app is healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# CMD specifies the command to run when the container starts
# node server.js is the Next.js standalone server
CMD ["node", "server.js"]
