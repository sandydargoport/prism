'use client';

import { createContext } from 'react';

/**
 * Which copy of a widget a polling hook belongs to.
 *
 * The screensaver is an overlay, not a wrapper: it renders its own widgets
 * from the registry while the dashboard grid stays mounted underneath. So
 * while the display is idle there are two live instances of every data hook,
 * and they want opposite things. The dashboard's copy is behind a full-screen
 * overlay and should stop; the screensaver's copy is the only thing anyone can
 * read and must keep going.
 *
 * Nothing else needs to care, which is why 'display' is the default and only
 * the screensaver overrides it.
 */
export type PollingScope = 'display' | 'screensaver';

export const PollingScopeContext = createContext<PollingScope>('display');
