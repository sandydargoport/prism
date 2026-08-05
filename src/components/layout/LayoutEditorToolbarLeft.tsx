'use client';

import * as React from 'react';
import { useMemo } from 'react';
import { LAYOUT_TEMPLATES } from '@/lib/constants/layoutTemplates';
import { SCREENSAVER_TEMPLATES } from '@/lib/constants/screensaverTemplates';
import { CommunityGallery } from './CommunityGallery';
import { CoordinateEditor } from './CoordinateEditor';
import { LayoutEditorPreviewPanel } from './LayoutEditorPreviewPanel';
import { PopoverButton } from './LayoutEditorPopover';
import { EditIcon } from './LayoutEditorIcons';
import { DashboardDropdown } from './LayoutEditorDashboardManager';
import type { ActivePopover, DashboardInfo } from './LayoutEditorTypes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import type { ScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';

interface ToolbarLeftProps {
  editingScreensaver: boolean;
  layoutName?: string;
  mode: 'dashboard' | 'screensaver';
  activePopover: ActivePopover;
  onTogglePopover: (name: ActivePopover) => void;
  screenGuideOrientation: 'landscape' | 'portrait';
  onScreenGuideOrientationChange?: (o: 'landscape' | 'portrait') => void;
  currentWidgets: WidgetConfig[];
  visibleWidgets: WidgetConfig[];
  onWidgetsChange: (w: WidgetConfig[]) => void;
  onSelectScreensaverPreset?: (w: WidgetConfig[]) => void;
  onSelectScreensaverTemplate?: (w: WidgetConfig[]) => void;
  onSaveAs: (name?: string) => void;
  onScreensaverSaveAs?: () => void;
  onApplyCommunityLayout: (widgets: WidgetConfig[], name: string) => void;
  focusedWidget: string | null;
  onFocusedWidgetChange: (id: string | null) => void;
  gridScrollY: number;
  gridVisibleRows: number;
  gridScrollX: number;
  gridVisibleCols: number;
  scrollToGridRef?: React.MutableRefObject<((row: number, col?: number) => void) | null>;
  allSizeNames: string[];
  effectiveEnabledSizes: string[];
  onToggleSize?: (size: string) => void;
  zones: ScreenSafeZones;
  validation: { errors: string[]; warnings: string[] };
  allDashboards: DashboardInfo[];
  currentDashboardId?: string;
  onSwitchDashboard?: (slug: string) => void;
  onCreateOpen: () => void;
  onRenameOpen: () => void;
}

const btnClass = 'px-2 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors';
const moreItemClass = 'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors';

export function LayoutEditorToolbarLeft({
  editingScreensaver,
  layoutName,
  mode,
  activePopover,
  onTogglePopover,
  screenGuideOrientation,
  onScreenGuideOrientationChange,
  currentWidgets,
  visibleWidgets,
  onWidgetsChange,
  onSelectScreensaverPreset,
  onSelectScreensaverTemplate,
  onSaveAs,
  onScreensaverSaveAs,
  onApplyCommunityLayout,
  focusedWidget,
  onFocusedWidgetChange,
  gridScrollY,
  gridVisibleRows,
  gridScrollX,
  gridVisibleCols,
  scrollToGridRef,
  allSizeNames,
  effectiveEnabledSizes,
  onToggleSize,
  zones,
  validation,
  allDashboards,
  currentDashboardId,
  onSwitchDashboard,
  onCreateOpen,
  onRenameOpen,
}: ToolbarLeftProps) {
  const templates = useMemo(() => {
    const allTemplates = editingScreensaver ? SCREENSAVER_TEMPLATES : LAYOUT_TEMPLATES;
    return Object.entries(allTemplates).filter(([, t]) => t.orientation === screenGuideOrientation);
  }, [editingScreensaver, screenGuideOrientation]);

  const handleSelectTemplate = (key: string) => {
    const template = LAYOUT_TEMPLATES[key];
    if (template) onWidgetsChange(template.widgets.map(w => ({ ...w, visible: true })));
    onTogglePopover('templates');
  };

  const handleSelectSsTemplate = (key: string) => {
    const template = SCREENSAVER_TEMPLATES[key];
    if (template && onSelectScreensaverTemplate) onSelectScreensaverTemplate(template.widgets);
    onTogglePopover('templates');
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {!editingScreensaver && onRenameOpen ? (
        <button
          onClick={onRenameOpen}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="Rename dashboard"
        >
          <EditIcon />
        </button>
      ) : (
        <EditIcon />
      )}

      {editingScreensaver ? (
        <span className="text-sm font-medium">Screensaver</span>
      ) : (
        <DashboardDropdown
          layoutName={layoutName}
          isActive={activePopover === 'dashboard'}
          onToggle={() => onTogglePopover('dashboard')}
          allDashboards={allDashboards}
          currentDashboardId={currentDashboardId}
          onSwitchDashboard={onSwitchDashboard}
          onClose={() => onTogglePopover('dashboard')}
          onCreateOpen={onCreateOpen}
        />
      )}

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Orientation toggle */}
      <button
        onClick={() => onScreenGuideOrientationChange?.(
          screenGuideOrientation === 'landscape' ? 'portrait' : 'landscape'
        )}
        className={`${btnClass} border ${
          screenGuideOrientation === 'landscape'
            ? 'bg-muted border-border hover:bg-accent'
            : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
        }`}
      >
        {screenGuideOrientation === 'landscape' ? '\u2B1C Landscape' : '\u25AF Portrait'}
      </button>

      {/* Widgets popover */}
      <PopoverButton
        label="Widgets"
        isActive={activePopover === 'widgets'}
        onToggle={() => onTogglePopover('widgets')}
        width={340}
      >
        <div className="p-2 max-h-[60vh] overflow-auto">
          <CoordinateEditor
            widgets={currentWidgets}
            onWidgetsChange={editingScreensaver && onSelectScreensaverPreset
              ? onSelectScreensaverPreset
              : onWidgetsChange
            }
            mode={mode}
            onFocusedWidgetChange={onFocusedWidgetChange}
          />
        </div>
      </PopoverButton>

      {/* Templates popover */}
      <PopoverButton
        label="Templates"
        isActive={activePopover === 'templates'}
        onToggle={() => onTogglePopover('templates')}
        width={200}
      >
        <div className="py-1">
          {templates.map(([key, template]) => (
            <button
              key={key}
              onClick={() => editingScreensaver ? handleSelectSsTemplate(key) : handleSelectTemplate(key)}
              className={moreItemClass}
            >
              {template.name}
            </button>
          ))}
          {templates.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground italic">
              No templates for {screenGuideOrientation}
            </div>
          )}
        </div>
      </PopoverButton>

      {/* Community popover */}
      <PopoverButton
        label="Community"
        isActive={activePopover === 'community'}
        onToggle={() => onTogglePopover('community')}
        width={640}
      >
        <div className="p-3 max-h-[60vh] overflow-auto">
          <CommunityGallery mode={mode} onApplyLayout={onApplyCommunityLayout} currentOrientation={screenGuideOrientation} />
        </div>
      </PopoverButton>

      {/* Mini-map popover — layout overview + screen-size toggles + validation */}
      <PopoverButton
        label={
          <>
            Mini-map
            {validation.errors.length > 0 && (
              <span className="ml-1 w-2 h-2 rounded-full bg-destructive inline-block" />
            )}
          </>
        }
        isActive={activePopover === 'preview'}
        onToggle={() => onTogglePopover('preview')}
        width={320}
      >
        <LayoutEditorPreviewPanel
          visibleWidgets={visibleWidgets}
          focusedWidget={focusedWidget ?? undefined}
          gridScrollY={gridScrollY}
          gridVisibleRows={gridVisibleRows}
          gridScrollX={gridScrollX}
          gridVisibleCols={gridVisibleCols}
          scrollToGridRef={scrollToGridRef}
          screenGuideOrientation={screenGuideOrientation}
          effectiveEnabledSizes={effectiveEnabledSizes}
          onToggleSize={onToggleSize}
          allSizeNames={allSizeNames}
          zones={zones}
          validation={validation}
        />
      </PopoverButton>
    </div>
  );
}

