'use client';

import { useState } from 'react';

const NONE = Symbol('none');

/**
 * Run `reset` during render whenever `key` changes, including the first render.
 *
 * React's "adjusting state when a prop changes": for a form that fills itself
 * from its props when a modal opens. Doing that in an effect painted the old
 * values first and then re-rendered with the new ones, and an effect that
 * listed the record object in its deps also refilled the form, over whatever
 * was being typed, whenever a background refresh handed it a new copy of the
 * same record.
 *
 * Here the reset happens in the same render that sees the new key, before
 * anything is painted. `key` must be a primitive (an id, or `null` while
 * closed), since it is compared with Object.is. `reset` may only set this
 * component's own state.
 */
export function useResetOn(key: string | number | boolean | null | undefined, reset: () => void): void {
  const [prev, setPrev] = useState<unknown>(NONE);
  if (!Object.is(prev, key)) {
    setPrev(key);
    reset();
  }
}
