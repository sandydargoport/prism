import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import type { IdleBackground } from '@/lib/idleBackground';
import type { ScreenPlan } from '@/lib/screenSwitches';
import type { EditTab, IdleHalf } from '@/components/dashboard/useDashboardLayout';
import type { IdleSwitchCheck } from './useIdleSwitchCheck';

export const EXPORT_VERSION = 2;

export interface DashboardInfo {
  id: string;
  name: string;
  slug: string | null;
  isDefault: boolean;
  /** 'today' is the built-in dashboard (#1151); anything else is the family's own. */
  view?: string | null;
}

export interface LayoutEditorProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  onSave: (name?: string) => void | Promise<void>;
  onSaveAs: (opts?: string | { id: string } | { name: string }) => void;
  onReset: () => void;
  onCancel: () => void;
  layoutName?: string;
  /** The canvas shows the dashboard in use or the screen idle (#782). */
  editTab?: EditTab;
  onEditTabChange?: (tab: EditTab) => void;
  /** Which tabs hold unsaved changes. */
  dashboardDirty?: boolean;
  idleDirty?: boolean;
  /** The screen shape picked on Look differs from the saved one (#1341). */
  lookDirty?: boolean;
  /** Make the default was pressed: Done makes it so (#1341). */
  defaultPending?: boolean;
  onMakeDefault?: () => void;
  /** Saves this dashboard without leaving the editor page, for Save and switch (#1341). */
  onSaveDashboard?: () => Promise<void>;
  /** The idle view, arranging a screensaver layout. */
  editingScreensaver?: boolean;
  screensaverWidgets?: WidgetConfig[];
  onScreensaverSaveAs?: () => void;
  onScreensaverReset?: () => void;
  onSelectScreensaverTemplate?: (templateWidgets: WidgetConfig[]) => void;
  onSelectScreensaverPreset?: (widgets: WidgetConfig[]) => void;
  /** What the display shows behind it when idle (#782). Omitted: no picker. */
  idleBackground?: IdleBackground;
  onIdleBackgroundChange?: (bg: IdleBackground) => void;
  /** Day or night on the canvas (#1348), in use or idle. */
  idleHalf?: IdleHalf;
  onIdleHalfChange?: (half: IdleHalf) => void;
  /** Tonight's times and whether the offsets cross, for a day and night pair. */
  idleCheck?: IdleSwitchCheck;
  /**
   * In a screen's editor, the dashboard the screen shows and its switches
   * (#1282), and how to change them; sent to the screen on Done.
   */
  screenPlan?: ScreenPlan | null;
  onScreenPlanChange?: (plan: ScreenPlan) => void;
  /**
   * Another dashboard the canvas shows as it is saved, while the Through the
   * day slider stands in its switch (#1294); null shows the one being edited.
   */
  previewDashboardId?: string | null;
  onPreviewDashboardChange?: (id: string | null) => void;
  /** The named screen being edited, or null for a dashboard on its own. */
  screenId?: string | null;
  /** The device in use has a name: nothing to offer naming it. */
  deviceNamed?: boolean;
  /** The device in use was named here: open its screen's editor. */
  onDeviceNamed?: (displayId: string) => void;
  screenGuideOrientation?: 'landscape' | 'portrait';
  onScreenGuideOrientationChange?: (o: 'landscape' | 'portrait') => void;
  gridScrollY?: number;
  gridVisibleRows?: number;
  gridScrollX?: number;
  gridVisibleCols?: number;
  scrollToGridRef?: React.MutableRefObject<((row: number, col?: number) => void) | null>;
  // Multi-dashboard props
  allDashboards?: DashboardInfo[];
  currentDashboardId?: string;
  onSwitchDashboard?: (slug: string) => void;
  onCreateDashboard?: (name: string, startFrom: 'blank' | 'template' | 'copy' | 'today') => void;
  onRenameDashboard?: (newName: string) => void;
  onDeleteDashboard?: () => void;
  /** The edited dashboard's kind: 'today' is the built-in one, edited by its widgets list, not a grid. */
  view?: string | null;
  /** Put the built-in dashboard's widgets back as they came. */
  onResetBuiltIn?: () => void;
  /**
   * The widget selected on the canvas (#1323): its own settings show in the
   * Widgets panel, which comes forward when one is selected.
   */
  selectedWidgetId?: string | null;
  onSelectedWidgetChange?: (id: string | null) => void;
  /** How the grid being edited draws the selected widget: see LayoutGridEditorProps. */
  hideEmptyByDefault?: boolean;
  idleToggles?: boolean;
  /** The line under the canvas naming what it draws (#1348), from the scene the wall reads. */
  canvasCaption?: string;
}

export interface ExportWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  minW?: number;
  minH?: number;
}

export interface LayoutExportV2 {
  type: 'prism-layout';
  version: number;
  mode: 'dashboard' | 'screensaver';
  name: string;
  description: string;
  author: string;
  tags: string[];
  screenSizes: string[];
  orientation: 'landscape' | 'portrait';
  widgets: ExportWidget[];
}

