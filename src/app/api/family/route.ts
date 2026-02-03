import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

interface FamilyMemberResponse {
  id: string;
  name: string;
  role: 'parent' | 'child' | 'guest';
  color: string;
  email: string | null;
  avatarUrl: string | null;
  hasPin: boolean;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    const query = db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        color: users.color,
        email: users.email,
        avatarUrl: users.avatarUrl,
        pin: users.pin,
        createdAt: users.createdAt,
      })
      .from(users);

    const results = await query.orderBy(desc(users.createdAt));

    let filteredResults = results;
    if (role && ['parent', 'child', 'guest'].includes(role)) {
      filteredResults = results.filter((user) => user.role === role);
    }

    const members: FamilyMemberResponse[] = filteredResults.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role as 'parent' | 'child' | 'guest',
      color: user.color,
      email: user.email,
      avatarUrl: user.avatarUrl,
      hasPin: !!user.pin,
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

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageUsers');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();

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

    let hashedPin: string | null = null;
    if (body.pin) {
      if (!/^\d{4,6}$/.test(body.pin)) {
        return NextResponse.json(
          { error: 'PIN must be 4-6 digits' },
          { status: 400 }
        );
      }
      hashedPin = await bcrypt.hash(body.pin, 12);
    }

    if (body.email && typeof body.email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

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
