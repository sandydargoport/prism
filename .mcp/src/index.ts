#!/usr/bin/env node
/**
 * Prism MCP Server
 *
 * Exposes the Prism family dashboard REST API as MCP tools so AI agents
 * (Claude Desktop, Cursor, VS Code Copilot Chat, etc.) can read and write
 * chores, tasks, events, shopping lists, messages, meals, goals, and more.
 *
 * The tools themselves live in tools.ts; time input in the household zone is
 * handled by time.ts.
 *
 * SDK: @modelcontextprotocol/sdk v1.29+ — uses the stdio transport and
 *   returns structured tool outputs (`structuredContent` alongside `content`)
 *   per the 2025-06-18 spec.
 *
 * Configuration (environment variables):
 *   PRISM_BASE_URL   Base URL of your Prism instance (e.g. https://prism.example.com)
 *   PRISM_API_TOKEN  Bearer token generated in Settings → Security → API Tokens
 *
 * Remote / hosted variant (Streamable HTTP transport + OAuth 2.1) is a
 * future addition — current build targets a local subprocess launched by
 * the AI client.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiError, householdTimeSource, registerTools } from './tools.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = (process.env.PRISM_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.PRISM_API_TOKEN ?? '';

if (!BASE_URL || !TOKEN) {
  process.stderr.write(
    'Error: PRISM_BASE_URL and PRISM_API_TOKEN environment variables are required.\n'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function api(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new ApiError(`Prism API ${method} ${path} → ${res.status}: ${text}`, res.status);
  }
  return data;
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'prism',
  version: '1.0.0',
});

registerTools(server, api, householdTimeSource(api));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
