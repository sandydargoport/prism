import { NextResponse } from 'next/server';
import { isSetupComplete } from '@/lib/setup';

export async function GET() {
  // "Complete" requires both the marker AND at least one family member —
  // a marker with zero users is a locked-out install, so it reports as
  // incomplete and routes the app back to /setup (see isSetupComplete).
  const complete = await isSetupComplete();
  return NextResponse.json({ complete });
}
