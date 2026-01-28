/**
 * ============================================================================
 * PRISM - Family Members API Route
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Handles HTTP requests for family member management.
 * Family members are the users who interact with the dashboard.
 *
 * ENDPOINT: /api/family
 * - GET:  List all family members
 * - POST: Add a new family member
 *
 * ROLES:
 * - parent: Full admin access, can manage everything
 * - child:  Limited permissions, can view and complete tasks/chores
 * - guest:  View-only access
 *
 * SECURITY NOTE:
 * PINs are hashed using bcrypt before storage.
 * Never return the PIN hash in API responses.
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';


/**
 * FAMILY MEMBER RESPONSE TYPE
 * ============================================================================
 * The shape of user data returned by the API.
 * Note: PIN is NEVER included in responses.
 * ============================================================================
 */
interface FamilyMemberResponse {
  id: string;
  name: string;
  role: 'parent' | 'child' | 'guest';
  color: string;
  email: string | null;
  avatarUrl: string | null;
  hasPin: boolean; // Indicates if user has a PIN set (without revealing it)
  createdAt: string;
}


/**
 * GET /api/family
 * ============================================================================
 * Lists all family members.
 *
 * QUERY PARAMETERS:
 * - role: Filter by role ("parent", "child", "guest")
 *
 * RESPONSE:
 * {
 *   members: FamilyMemberResponse[],
 *   total: number
 * }
 *
 * NOTE: PINs are never returned, only a `hasPin` boolean.
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    // Build query
    const query = db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        color: users.color,
        email: users.email,
        avatarUrl: users.avatarUrl,
        pin: users.pin, // We need this to check hasPin, but won't return it
        createdAt: users.createdAt,
      })
      .from(users);

    // Filter by role if specified
    const results = await query.orderBy(desc(users.createdAt));

    // Filter in memory if role specified (Drizzle typing is complex for this)
    let filteredResults = results;
    if (role && ['parent', 'child', 'guest'].includes(role)) {
      filteredResults = results.filter((user) => user.role === role);
    }

    // Format response - NEVER include the actual PIN
    const members: FamilyMemberResponse[] = filteredResults.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role as 'parent' | 'child' | 'guest',
      color: user.color,
      email: user.email,
      avatarUrl: user.avatarUrl,
      hasPin: !!user.pin, // Boolean indicating if PIN is set
      createdAt: user.createdAt.toISOString(),
    }));

    return NextResponse.json({
      members,
      total: members.length,
    });
  } catch (error) {
    console.error('Error fetching family members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family members' },
      { status: 500 }
    );
  }
}


/**
 * POST /api/family
 * ============================================================================
 * Adds a new family member.
 *
 * REQUEST BODY:
 * {
 *   name: string (required)
 *   role: "parent" | "child" | "guest" (required)
 *   color: string (required, hex color like "#3B82F6")
 *   pin?: string (4-6 digit PIN, will be hashed)
 *   email?: string
 *   avatarUrl?: string
 * }
 *
 * SECURITY:
 * - PIN is hashed with bcrypt (cost factor 12)
 * - Only parents can add new family members (enforce in middleware)
 *
 * RESPONSE:
 * - 201: Member created successfully
 * - 400: Invalid request body
 * - 500: Server error
 * ============================================================================
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!body.role || !['parent', 'child', 'guest'].includes(body.role)) {
      return NextResponse.json(
        { error: 'Role must be "parent", "child", or "guest"' },
        { status: 400 }
      );
    }

    if (!body.color || !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json(
        { error: 'Color must be a valid hex color (e.g., #3B82F6)' },
        { status: 400 }
      );
    }

    // Validate PIN if provided
    let hashedPin: string | null = null;
    if (body.pin) {
      // PIN must be 4-6 digits
      if (!/^\d{4,6}$/.test(body.pin)) {
        return NextResponse.json(
          { error: 'PIN must be 4-6 digits' },
          { status: 400 }
        );
      }
      // Hash the PIN with bcrypt
      // Cost factor 12 is a good balance of security and speed
      hashedPin = await bcrypt.hash(body.pin, 12);
    }

    // Validate email if provided
    if (body.email && typeof body.email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Insert the new family member
    const [newMember] = await db
      .insert(users)
      .values({
        name: body.name.trim(),
        role: body.role,
        color: body.color,
        pin: hashedPin,
        email: body.email?.trim() || null,
        avatarUrl: body.avatarUrl || null,
        preferences: body.preferences || {},
      })
      .returning();

    if (!newMember) {
      return NextResponse.json(
        { error: 'Failed to create family member' },
        { status: 500 }
      );
    }

    // Format response - NEVER include the PIN hash
    const response: FamilyMemberResponse = {
      id: newMember.id,
      name: newMember.name,
      role: newMember.role as 'parent' | 'child' | 'guest',
      color: newMember.color,
      email: newMember.email,
      avatarUrl: newMember.avatarUrl,
      hasPin: !!hashedPin,
      createdAt: newMember.createdAt.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating family member:', error);
    return NextResponse.json(
      { error: 'Failed to create family member' },
      { status: 500 }
    );
  }
}
