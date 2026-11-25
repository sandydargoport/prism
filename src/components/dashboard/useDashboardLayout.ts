'use client';

import { remoteEditHost } from '@/lib/displays/remoteEdit';
import { editorLink, editsOnCanvas } from '@/lib/displays/editPlace';
import { useHoldEditing } from '@/lib/hooks/useEditing';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_TEMPLATE } from '@/lib/constants/layoutTemplates';
import {
  DEFAULT_SCREENSAVER_LAYOUT,
  screensaverForDashboard,
  legacyScreensaver,
  markScreensaverCarried,
  owesLegacyScreensaver,
  saveScreensaverPreset,
} from '@/components/screensaver/screensaverStorage';
import { setPhotoFrameArrangement } from '@/components/screensaver/photoFrameArrangement';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import type { WidgetConfig, Layout } from '@/lib/hooks/useLayouts';
import { idleSources, sameIdleBackground, type IdleBackground, type IdleSource } from '@/lib/idleBackground';
import { backgroundOf, withBackground } from '@/lib/screenDay';
import { useScreenDay } from '@/components/screensaver/useScreenDay';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUrlParam } from '@/lib/hooks/useUrlParam';
import { useResetOn } from '@/lib/hooks/useResetOn';

interface LayoutsData {
  savedLayout: Layout | null;
  saveLayout: (data: Partial<Layout> & { name: string; widgets: WidgetConfig[] }) => Promise<unknown>;
  deleteLayout: (id: string) => Promise<void>;
  allLayouts: Layout[];
  loading: boolean;
  /** Fetches them again, so an edit made on another device shows here. */
  refresh?: () => Promise<void>;
}

/**
 * How often the dashboards are fetched again, so an edit made on another
 * device reaches this screen without a reload (#1346). It keeps going while
 * the photo frame is up: its arrangement is what an idle screen shows.
 */
export const LAYOUTS_REFRESH_MS = 60 * 1000;

/** The query parameter that opens a dashboard in edit mode. */
export const EDIT_PARAM = 'edit';

/** What the canvas shows (#782): the dashboard in use, or the screen idle; the canvas's In use | Idle (#1348). */
export type EditTab = 'dashboard' | 'idle';

/** Day or night on the canvas, in use or idle: the canvas's Day | Night (#1348). */
export type IdleHalf = 'day' | 'night';

/** The background the idle view shows: the one there is, or the previewed half. */
export function shownIdleSource(bg: IdleBackground, half: IdleHalf): IdleSource {
  return 'source' in bg ? bg.source : bg[half];
}

/**
 * Whether the idle view edits a screensaver layout (shown over photos or
 * the sky), rather than the dashboard's own Stays / Fades. A pair with photos
 * or the sky on either half has one to edit.
 */
export function editsIdleLayout(bg: IdleBackground): boolean {
  return idleSources(bg).some(s => s !== 'dashboard' && s !== 'off');
}

/** Whether a widget stays or fades when idle: the part of a widget the idle view owns. */
const withoutIdleTicks = (widgets: WidgetConfig[]) =>
  JSON.stringify(widgets.map(({ showWhenIdle: _ignored, ...w }) => w));
const idleTicks = (widgets: WidgetConfig[]) => JSON.stringify(widgets.map(w => [w.i, w.showWhenIdle]));

/**
 * Offers a browser's kept screensaver to a dashboard (#1154). True when the
 * dashboard has one now, whether this one or one saved meanwhile.
 */
async function carryScreensaver(id: string, widgets: WidgetConfig[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/layouts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screensaverWidgets: widgets, carryOver: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** A link to the dashboard at `path` that opens it in edit mode. */
export function editLink(path: string): string {
  return `${path}?${EDIT_PARAM}=1`;
}

export function useDashboardLayout(layouts: LayoutsData, slug?: string) {
  const { activeUser, requireAuth } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  // The screen does not go idle while its dashboard is in edit mode (#1342).
  useHoldEditing(isEditing);
  const [editingWidgets, setEditingWidgets] = useState<WidgetConfig[]>([]);
  const [preEditWidgets, setPreEditWidgets] = useState<WidgetConfig[]>([]);
  const [editTab, setEditTab] = useState<EditTab>('dashboard');
  const [idleHalf, setIdleHalf] = useState<IdleHalf>('day');

  // Resolve active layout: by slug if provided, otherwise default
  const activeLayout = slug
    ? layouts.allLayouts.find(l => l.slug === slug) || null
    : layouts.savedLayout;

  // The arrangement a browser kept from v1.30.1, while it is owed to this
  // dashboard (#1154): shown until the dashboard has one of its own.
  const [owed, setOwed] = useState<{ id: string; widgets: WidgetConfig[] } | null>(null);
  // The photo frame arrangement as saved (#1346): the dashboard's own, which
  // follows the dashboard as it is fetched again, so an edit made on another
  // device shows here without a reload.
  const savedSs = activeLayout?.screensaverWidgets
    ?? (owed && owed.id === activeLayout?.id ? owed.widgets : null)
    ?? (activeLayout ? screensaverForDashboard(activeLayout) : DEFAULT_SCREENSAVER_LAYOUT);
  // As being edited: null until it is changed, so it follows the saved one,
  // a dashboard that finishes loading after editing starts included.
  const [editedSs, setEditedSs] = useState<WidgetConfig[] | null>(null);
  const ssLayout = isEditing && editedSs !== null ? editedSs : savedSs;
  const ssDirty = isEditing && editedSs !== null && JSON.stringify(editedSs) !== JSON.stringify(savedSs);
  // What shows behind it when idle, as saved and as being edited. It is the
  // screen's own day (#1345), whichever dashboard is open; the dashboard's
  // old `idleBackground` is no longer read. Nothing is stored until Save, so
  // Cancel only has to put these back.
  const { day: screenDay, setDay: setScreenDay } = useScreenDay();
  const savedBackground = backgroundOf(screenDay);
  // Null from the start of editing until it is changed, so it follows the
  // saved value: the dashboard can finish loading after editing starts. (Seeded
  // with the saved value only because the React compiler's memoization check
  // rejects a null start here; editing always begins by resetting it.)
  const [editedBackground, setEditedBackground] = useState<IdleBackground | null>(savedBackground);
  const editingBackground = editedBackground === null ? savedBackground : editedBackground;
  // The screen shape the guides are drawn for, and Make the default, wait for
  // Done like everything else in the editor (#1341). Null follows the saved one.
  const savedOrientation: 'landscape' | 'portrait' = activeLayout?.orientation === 'portrait' ? 'portrait' : 'landscape';
  const [editedOrientation, setEditedOrientation] = useState<'landscape' | 'portrait' | null>(null);
  const editingOrientation = editedOrientation ?? savedOrientation;
  const [defaultPending, setDefaultPending] = useState(false);

  // The upgrade from v1.30.1 (#1154), once per dashboard opened: a dashboard
  // with no photo frame arrangement of its own showed the one this browser
  // kept. It is shown and carried onto the dashboard; the server keeps it only
  // while the dashboard still has none. Until that works (a wall nobody signed
  // in to cannot save) it keeps showing here, as before. Nothing else reads
  // the browser's copy (#1346).
  useResetOn(activeLayout?.id ?? null, () => {
    const legacy = activeLayout && !remoteEditHost() ? legacyScreensaver() : null;
    setOwed(activeLayout && owesLegacyScreensaver(activeLayout, editsIdleLayout(savedBackground), legacy)
      ? { id: activeLayout.id, widgets: legacy }
      : null);
  });
  const carriedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!activeLayout) return;
    if (carriedFor.current === activeLayout.id) return;
    carriedFor.current = activeLayout.id;
    if (owed && owed.id === activeLayout.id) {
      void carryScreensaver(owed.id, owed.widgets).then((ok) => { if (ok) markScreensaverCarried(); });
    } else {
      markScreensaverCarried();
    }
    // Runs once per dashboard (the ref above); the screen's day at that
    // moment decided whether a carried arrangement is owed.
  }, [activeLayout, owed]);

  // The running photo frame shows the saved arrangement of the dashboard this
  // screen shows (#1346); an edit reaches it once saved.
  useEffect(() => {
    if (layouts.loading) return;
    setPhotoFrameArrangement(savedSs);
  }, [layouts.loading, savedSs]);
  // Fetched again while open, so an edit from another device arrives.
  const refreshLayouts = layouts.refresh;
  useVisibilityPolling(() => { void refreshLayouts?.(); }, LAYOUTS_REFRESH_MS, { pollWhileIdle: true });

  // Switching dashboards from the editor opens the next one with ?edit=1, and
  // it opens in edit mode once its layout has loaded. Only for a parent, so a
  // link kept past a logout or session expiry does not re-engage edit mode.
  // The frame of a phone editing a screen is always in edit mode (#1153), a
  // reload included.
  const resumeEditing = useUrlParam(EDIT_PARAM) === '1' || remoteEditHost() !== null;
  const resumeKey = resumeEditing && activeLayout && activeUser?.role === 'parent'
    ? activeLayout.id
    : null;
  const beginEditing = useCallback(() => {
    const current = activeLayout?.widgets ?? DEFAULT_TEMPLATE.widgets;
    setPreEditWidgets(current);
    setEditingWidgets(current);
    setEditedSs(null);
    setEditedBackground(null);
    setEditedOrientation(null);
    setDefaultPending(false);
    setEditTab('dashboard');
    setIdleHalf('day');
    setIsEditing(true);
  }, [activeLayout]);
  // A device that edits on a canvas (#1265) is sent there instead, in place
  // of this address, so Back does not land on the link again.
  const resumeOnCanvas = resumeKey !== null && editsOnCanvas();
  useResetOn(resumeKey, () => {
    if (!resumeKey || !activeLayout || editsOnCanvas()) return;
    beginEditing();
  });
  // Then drop it from the address, so a reload opens the dashboard normally.
  useEffect(() => {
    if (!resumeKey) return;
    if (resumeOnCanvas) {
      router.replace(editorLink(resumeKey));
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete(EDIT_PARAM);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, [resumeKey, resumeOnCanvas, router]);

  // While layouts are still fetching, render NOTHING rather than falling
  // back to DEFAULT_TEMPLATE — for any established user whose saved layout
  // doesn't exactly match the template, that fallback shows a stale set of
  // widgets for a fraction of a second before swapping to the real one, and
  // the swap reads as "Prism flashed a different dashboard at me." A blank
  // frame for the same fraction-second is less disorienting than a wrong
  // one. We only fall back to DEFAULT_TEMPLATE once loading completes AND
  // no saved layout exists (genuine first-run / blank-slate install).
  const activeWidgets = isEditing
    ? editingWidgets
    : activeLayout?.widgets
      ?? (layouts.loading ? [] : DEFAULT_TEMPLATE.widgets);

  const handleEditStart = useCallback(async () => {
    // Auth gate: only parents can edit. Signed out, the PIN box opens and
    // editing starts once a parent signs in; a non-parent is quietly
    // blocked (their edit button is already hidden, so this is a safety net).
    const user = activeUser ?? await requireAuth('Sign in to edit', "Enter a parent's PIN to edit the dashboard layout.", { parentsOnly: true });
    if (!user || user.role !== 'parent') return;
    if (activeLayout && editsOnCanvas()) {
      router.push(editorLink(activeLayout.id));
      return;
    }
    beginEditing();
  }, [activeUser, requireAuth, beginEditing, activeLayout, router]);

  // Which tabs hold changes not yet saved, for the dot on each.
  const dashboardDirty = isEditing && withoutIdleTicks(editingWidgets) !== withoutIdleTicks(preEditWidgets);
  // The photo frame's arrangement or which widgets stay (Widgets), and the
  // screen's idle looks and night rule (Screen, #1349).
  const idleLayoutDirty = isEditing && (ssDirty || idleTicks(editingWidgets) !== idleTicks(preEditWidgets));
  const screenDayDirty = isEditing && !sameIdleBackground(editingBackground, savedBackground);
  const idleDirty = idleLayoutDirty || screenDayDirty;
  // Look's dot: the screen shape changed. Dashboard's: Make the default pressed.
  const lookDirty = isEditing && editingOrientation !== savedOrientation;
  const defaultDirty = isEditing && defaultPending && !activeLayout?.isDefault;

  // The running photo frame gets the edited arrangement once it is saved to
  // the dashboard, which is fetched again on save.
  const finishEditing = useCallback(() => {
    setEditedSs(null);
    setEditTab('dashboard');
    setEditedOrientation(null);
    setDefaultPending(false);
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async (name?: string) => {
    try {
      const saveData: Partial<Layout> & { name: string; widgets: WidgetConfig[] } = {
        ...(activeLayout ? { id: activeLayout.id } : {}),
        name: name || activeLayout?.name || 'My Layout',
        widgets: editingWidgets,
        // Make the default is kept here until Done (#1341); saving it as the
        // default unsets the one before.
        isDefault: defaultPending || (activeLayout?.isDefault ?? true),
        orientation: editingOrientation,
      };
      // Done saves only what changed (#1162). A dashboard with no screensaver
      // layout or background of its own keeps none until someone sets one;
      // saving the default it was showing would pin it there for good.
      if (activeLayout?.screensaverWidgets || ssDirty) {
        saveData.screensaverWidgets = ssLayout;
      }
      // The idle and night looks are the screen's (#1345): Done writes them
      // to its day, keeping how much darker, and never to the dashboard.
      if (!sameIdleBackground(editingBackground, savedBackground)) {
        setScreenDay(withBackground(screenDay, editingBackground));
      }
      await layouts.saveLayout(saveData);
    } catch (err) {
      console.error('Failed to save layout:', err);
    } finally {
      finishEditing();
    }
  }, [activeLayout, editingWidgets, ssLayout, ssDirty, editingBackground, savedBackground, screenDay, setScreenDay, defaultPending, editingOrientation, layouts, finishEditing]);

  // Save-As supports two modes:
  //   - { id }: overwrite an existing dashboard. Preserves the target's
  //     name, slug, and isDefault — only widgets + screensaver are swapped.
  //     The dialog shows a confirm step before this fires.
  //   - { name }: create a new dashboard with the given name. Same behavior
  //     as the previous prompt() flow, just driven by a real dialog input.
  // Legacy callers passing a bare string (e.g. the Apply Community Layout
  // path) still get the new-dashboard branch via the string overload.
  const handleSaveAs = useCallback(async (
    opts?: string | { id: string } | { name: string },
  ) => {
    if (!opts) return;
    if (typeof opts === 'string') opts = { name: opts };

    if ('id' in opts) {
      const target = layouts.allLayouts.find(l => l.id === opts.id);
      if (!target) return;
      await layouts.saveLayout({
        id: target.id,
        name: target.name,
        widgets: editingWidgets,
        isDefault: target.isDefault,
        screensaverWidgets: ssLayout,
        orientation: target.orientation || 'landscape',
      });
    } else {
      const name = opts.name.trim();
      if (!name) return;
      await layouts.saveLayout({
        name,
        widgets: editingWidgets,
        isDefault: false,
        screensaverWidgets: ssLayout,
        orientation: editingOrientation,
      });
    }
    // The idle and night looks are the screen's, whichever dashboard it saves to.
    if (!sameIdleBackground(editingBackground, savedBackground)) {
      setScreenDay(withBackground(screenDay, editingBackground));
    }
    finishEditing();
  }, [editingWidgets, ssLayout, editingBackground, savedBackground, screenDay, setScreenDay, editingOrientation, layouts, finishEditing]);

  const handleReset = useCallback(() => {
    setEditingWidgets(DEFAULT_TEMPLATE.widgets);
  }, []);

  // Cancel undoes both tabs.
  const handleCancel = useCallback(() => {
    setEditingWidgets(preEditWidgets);
    setEditedSs(null);
    setEditedBackground(null);
    setEditedOrientation(null);
    setDefaultPending(false);
    setEditTab('dashboard');
    setIsEditing(false);
  }, [preEditWidgets]);

  const handleSsLayoutChange = useCallback((newLayout: WidgetConfig[]) => {
    setEditedSs(newLayout);
  }, []);

  const handleSsSaveAs = useCallback(() => {
    const name = window.prompt('Preset name:', 'My Screensaver');
    if (!name) return;
    saveScreensaverPreset(name, ssLayout);
  }, [ssLayout]);

  const handleSsReset = useCallback(() => {
    const fresh = DEFAULT_SCREENSAVER_LAYOUT.map(w => ({ ...w }));
    setEditedSs(fresh);
  }, []);

  const handleSelectSsTemplate = useCallback((templateWidgets: WidgetConfig[]) => {
    const visibleIds = new Set(templateWidgets.filter(w => w.visible !== false).map(w => w.i));
    const merged = DEFAULT_SCREENSAVER_LAYOUT.map(def => {
      const tw = templateWidgets.find(t => t.i === def.i);
      if (tw) return { ...tw, visible: true };
      return { ...def, visible: false };
    });
    templateWidgets.forEach(tw => {
      if (!merged.find(m => m.i === tw.i)) {
        merged.push({ ...tw, visible: visibleIds.has(tw.i) });
      }
    });
    setEditedSs(merged);
  }, []);

  const handleSelectSsPreset = useCallback((presetWidgets: WidgetConfig[]) => {
    setEditedSs(presetWidgets);
  }, []);

  // Make the default, done on Done (#1341).
  const makeDefault = useCallback(() => setDefaultPending(true), []);

  return {
    isEditing, setIsEditing,
    editingWidgets, setEditingWidgets,
    editTab, setEditTab,
    idleHalf, setIdleHalf,
    // The idle view showing a screensaver layout to edit, rather than
    // the dashboard's own Stays / Fades.
    editingScreensaver: isEditing && editTab === 'idle' && !['dashboard', 'off'].includes(shownIdleSource(editingBackground, idleHalf)),
    editingBackground, setEditingBackground: setEditedBackground,
    dashboardDirty, idleDirty, idleLayoutDirty, screenDayDirty, lookDirty, defaultDirty,
    editingOrientation, setEditingOrientation: setEditedOrientation,
    makeDefault,
    ssLayout,
    activeWidgets,
    activeLayout,
    handleEditStart, handleSave, handleSaveAs, handleReset, handleCancel,
    handleSsLayoutChange, handleSsSaveAs,
    handleSsReset, handleSelectSsTemplate, handleSelectSsPreset,
  };
}
