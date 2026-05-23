import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export const EXPORT_VERSION = 2;

export interface SavedLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
}

export interface DashboardInfo {
  id: string;
  name: string;
  slug: string | null;
  isDefault: boolean;
}

export interface LayoutEditorProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  onSave: (name?: string) => void | Promise<void>;
  onSaveAs: (opts?: string | { id: string } | { name: string }) => void;
  onReset: () => void;
  onCancel: () => void;
  onDeleteLayout?: (id: string) => void;
  layoutName?: string;
  savedLayouts?: SavedLayout[];
  editingScreensaver?: boolean;
  onToggleScreensaverEdit?: () => void;
  screensaverWidgets?: WidgetConfig[];
  onScreensaverWidgetToggle?: (widgetType: string, visible: boolean) => void;
  onScreensaverSave?: () => void;
  onScreensaverSaveAs?: () => void;
  onScreensaverReset?: () => void;
  onSelectScreensaverTemplate?: (templateWidgets: WidgetConfig[]) => void;
  screensaverPresets?: Array<{ name: string; widgets: WidgetConfig[] }>;
  onSelectScreensaverPreset?: (widgets: WidgetConfig[]) => void;
  onDeleteScreensaverPreset?: (name: string) => void;
  screenGuideOrientation?: 'landscape' | 'portrait';
  onScreenGuideOrientationChange?: (o: 'landscape' | 'portrait') => void;
  enabledSizes?: string[];
  onToggleSize?: (size: string) => void;
  gridScrollY?: number;
  gridVisibleRows?: number;
  gridScrollX?: number;
  gridVisibleCols?: number;
  gridTotalRows?: number;
  gridTotalCols?: number;
  scrollToGridRef?: React.MutableRefObject<((row: number, col?: number) => void) | null>;
  // Multi-dashboard props
  allDashboards?: DashboardInfo[];
  currentDashboardId?: string;
  onSwitchDashboard?: (slug: string) => void;
  onCreateDashboard?: (name: string, startFrom: 'blank' | 'template' | 'copy') => void;
  onRenameDashboard?: (newName: string) => void;
  onDeleteDashboard?: () => void;
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

export type ActivePopover = 'dashboard' | 'widgets' | 'templates' | 'community' | 'preview' | 'more' | 'save' | null;
