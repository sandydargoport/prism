/**
 * ============================================================================
 * PRISM - Health Check API Endpoint
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides a simple health check endpoint for monitoring the application.
 * External tools (Docker, load balancers, monitoring systems) call this
 * endpoint to verify the application is running and responding.
 *
 * URL: GET /api/health
 *
 * HOW NEXT.JS API ROUTES WORK:
 * In the App Router, API routes are defined in route.ts files.
 * The HTTP method is determined by the exported function name:
 *   - export function GET() -> handles GET requests
 *   - export function POST() -> handles POST requests
 *   - export function PUT() -> handles PUT requests
 *   - etc.
 *
 * FILE LOCATION EXPLAINED:
 * src/app/api/health/route.ts -> /api/health
 * src/app/api/tasks/route.ts  -> /api/tasks
 * src/app/api/tasks/[id]/route.ts -> /api/tasks/:id
 *
 * RESPONSE FORMAT:
 * Returns JSON with:
 *   - status: "ok" if healthy
 *   - timestamp: Current server time (ISO format)
 *   - version: Application version (from package.json)
 *   - uptime: How long the server has been running (seconds)
 *
 * ============================================================================
 */

import { NextResponse } from 'next/server';


/**
 * GET /api/health
 * ============================================================================
 * Returns the health status of the application.
 *
 * This endpoint is used by:
 * - Docker health checks (see Dockerfile)
 * - Load balancers to determine if this instance can receive traffic
 * - Monitoring tools (Uptime Robot, Pingdom, etc.)
 * - Developers to verify the app is running
 *
 * RESPONSE CODES:
 * - 200 OK: Application is healthy
 * - 503 Service Unavailable: Application has problems (future: DB down, etc.)
 *
 * FUTURE ENHANCEMENTS:
 * - Check database connection
 * - Check Redis connection
 * - Check external API connectivity
 * - Return more detailed diagnostics
 * ============================================================================
 */
export async function GET() {
  // In the future, we'll add checks for:
  // - Database connectivity
  // - Redis connectivity
  // - External API status
  // For now, if this code runs, we're healthy!

  const healthCheck = {
    // Overall status
    status: 'ok',

    // Current server timestamp (useful for debugging time issues)
    timestamp: new Date().toISOString(),

    // Application version (from environment, set in next.config.js)
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

    // Server uptime in seconds
    // process.uptime() returns seconds since Node.js process started
    uptime: Math.floor(process.uptime()),

    // Environment (development, production, test)
    environment: process.env.NODE_ENV || 'development',

    // Memory usage (useful for debugging memory leaks)
    memory: {
      // Convert bytes to MB for readability
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB',
    },
  };

  // Return JSON response with 200 OK status
  // NextResponse.json() automatically sets Content-Type: application/json
  return NextResponse.json(healthCheck, {
    status: 200,
    headers: {
      // Cache control: Don't cache health checks
      // We always want fresh data
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}


/**
 * OPTIONS /api/health
 * ============================================================================
 * Handle CORS preflight requests.
 *
 * When a browser makes a cross-origin request, it first sends an OPTIONS
 * request to check if the actual request is allowed. This is called a
 * "preflight" request.
 *
 * For health checks, this is usually not needed (server-to-server),
 * but we include it for completeness.
 * ============================================================================
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204, // No Content
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
