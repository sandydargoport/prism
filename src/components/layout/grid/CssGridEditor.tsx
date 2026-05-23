'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import {
  DndContext,
  useDraggable,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import { WidgetBgOverrideProvider } from '@/components/widgets/WidgetContainer';
import { getWidgetStyle, getWidgetContentStyle, getTextColorClass } from './gridWidgetStyles';
import type { EditorTheme } from './gridEditorTypes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'se' | 'sw';

type EditMode = 'move' | 'resize';

export interface CssGridEditorProps {
  layout: WidgetConfig[];
  onLayoutChange: (layout: WidgetConfig[]) => void;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  widgetConstraints?: Record<string, { minW?: number; minH?: number }>;
  cellSize: number;
  margin: number;
  containerPadding: number;
  cols: number;
  totalRows: number;
  totalCols: number;
  selectedWidget: string | null;
  onSelectWidget: (id: string | null) => void;
  theme: EditorTheme;
}

export function CssGridEditor({
  layout,
  onLayoutChange,
  renderWidget,
  widgetConstraints,
  cellSize,
  margin,
  containerPadding,
  cols,
  totalRows,
  totalCols,
  selectedWidget,
  onSelectWidget,
  theme,
}: CssGridEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('move');
  const [resizePreview, setResizePreview] = useState<{
    widgetId: string;
    x: number; y: number; w: number; h: number;
  } | null>(null);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const step = cellSize + margin;

  // Custom grid snap modifier — snaps drag overlay to grid cells
  const stepRef = useRef(step);
  stepRef.current = step;
  const gridSnapModifier: Modifier = useCallback(({ transform }) => ({
    ...transform,
    x: Math.round(transform.x / stepRef.current) * stepRef.current,
    y: Math.round(transform.y / stepRef.current) * stepRef.current,
  }), []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  );

  // Cycle: unselected → move → resize → deselect
  const handleWidgetClick = useCallback((id: string) => {
    if (selectedWidget !== id) {
      onSelectWidget(id);
      setEditMode('move');
    } else if (editMode === 'move') {
      setEditMode('resize');
    } else {
      onSelectWidget(null);
      setEditMode('move');
    }
  }, [selectedWidget, editMode, onSelectWidget]);

  // Reset mode when widget is deselected externally
  const handleDeselect = useCallback(() => {
    onSelectWidget(null);
    setEditMode('move');
  }, [onSelectWidget]);

  const visibleWidgets = useMemo(
    () => layout.filter(w => w.visible !== false),
    [layout],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveId(null);

    const deltaCol = Math.round(delta.x / step);
    const deltaRow = Math.round(delta.y / step);
    if (deltaCol === 0 && deltaRow === 0) return;

    const widgetId = active.id as string;
    const updated = layoutRef.current.map(w => {
      if (w.i === widgetId) {
        return { ...w, x: Math.max(0, w.x + deltaCol), y: Math.max(0, w.y + deltaRow) };
      }
      return w;
    });
    onLayoutChange(updated);
  }, [step, onLayoutChange]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Resize via pointer events on handles
  const handleResizeStart = useCallback((widgetId: string, edge: ResizeEdge, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const widget = layoutRef.current.find(w => w.i === widgetId);
    if (!widget) return;

    const orig = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    const startX = e.clientX;
    const startY = e.clientY;
    const currentStep = stepRef.current;

    setResizePreview({ widgetId, ...orig });

    const onMove = (ev: PointerEvent) => {
      const dCol = Math.round((ev.clientX - startX) / currentStep);
      const dRow = Math.round((ev.clientY - startY) / currentStep);

      const constraints = widgetConstraints?.[widgetId];
      const minW = constraints?.minW ?? 1;
      const minH = constraints?.minH ?? 1;

      let { x, y, w, h } = orig;

      if (edge.includes('e')) w = Math.max(minW, orig.w + dCol);
      if (edge.includes('s')) h = Math.max(minH, orig.h + dRow);
      if (edge.includes('w')) {
        const newX = Math.max(0, orig.x + dCol);
        x = Math.min(newX, orig.x + orig.w - minW);
        w = orig.x + orig.w - x;
      }
      if (edge.includes('n')) {
        const newY = Math.max(0, orig.y + dRow);
        y = Math.min(newY, orig.y + orig.h - minH);
        h = orig.y + orig.h - y;
      }

      setResizePreview({ widgetId, x, y, w, h });
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);

      setResizePreview(prev => {
        if (!prev) return null;
        const updated = layoutRef.current.map(w => {
          if (w.i === widgetId) {
            return { ...w, x: prev.x, y: prev.y, w: prev.w, h: prev.h };
          }
          return w;
        });
        onLayoutChange(updated);
        return null;
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [widgetConstraints, onLayoutChange]);

  // Get widget position — may be overridden during resize
  const getWidgetPos = useCallback((w: WidgetConfig) => {
    if (resizePreview?.widgetId === w.i) {
      return { x: resizePreview.x, y: resizePreview.y, w: resizePreview.w, h: resizePreview.h };
    }
    return { x: w.x, y: w.y, w: w.w, h: w.h };
  }, [resizePreview]);

  const activeWidget = activeId ? visibleWidgets.find(w => w.i === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      modifiers={[gridSnapModifier]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${totalCols}, ${cellSize}px)`,
          gridAutoRows: `${cellSize}px`,
          gap: `${margin}px`,
          padding: `${containerPadding}px`,
          position: 'relative',
          zIndex: 10,
        }}
        onClick={handleDeselect}
      >
        {visibleWidgets.map(w => (
          <DraggableWidget
            key={w.i}
            widget={w}
            pos={getWidgetPos(w)}
            isSelected={selectedWidget === w.i}
            isDragging={activeId === w.i}
            editMode={selectedWidget === w.i ? editMode : 'move'}
            onSelect={handleWidgetClick}
            onResizeStart={handleResizeStart}
            renderWidget={renderWidget}
            theme={theme}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeWidget ? (
          <DragOverlayContent
            widget={activeWidget}
            cellSize={cellSize}
            margin={margin}
            renderWidget={renderWidget}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Drag overlay — follows pointer with grid snapping
function DragOverlayContent({
  widget,
  cellSize,
  margin,
  renderWidget,
}: {
  widget: WidgetConfig;
  cellSize: number;
  margin: number;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
}) {
  const widgetStyle = getWidgetStyle(widget);
  const contentStyle = getWidgetContentStyle(widget);
  const textClass = getTextColorClass(widget);

  return (
    <div
      style={{
        width: widget.w * cellSize + (widget.w - 1) * margin,
        height: widget.h * cellSize + (widget.h - 1) * margin,
        ...widgetStyle,
        opacity: 0.85,
      }}
      className={`rounded-lg border-2 border-primary shadow-lg ${textClass}`}
    >
      <WidgetBgOverrideProvider value={{ hasCustomBg: !!widget.backgroundColor, textColor: widget.textColor, textOpacity: widget.textOpacity, gridLineOpacity: widget.gridLineOpacity, cellBackgroundColor: widget.cellBackgroundColor, cellBackgroundOpacity: widget.cellBackgroundOpacity }}>
        <div className="h-full w-full overflow-hidden" style={{ pointerEvents: 'none', ...contentStyle }}>
          {renderWidget(widget)}
        </div>
      </WidgetBgOverrideProvider>
    </div>
  );
}

// Individual draggable widget cell
interface DraggableWidgetProps {
  widget: WidgetConfig;
  pos: { x: number; y: number; w: number; h: number };
  isSelected: boolean;
  isDragging: boolean;
  editMode: EditMode;
  onSelect: (id: string) => void;
  onResizeStart: (widgetId: string, edge: ResizeEdge, e: React.PointerEvent) => void;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  theme: EditorTheme;
}

function DraggableWidget({
  widget,
  pos,
  isSelected,
  isDragging,
  editMode,
  onSelect,
  onResizeStart,
  renderWidget,
  theme,
}: DraggableWidgetProps) {
  const inMoveMode = isSelected && editMode === 'move';
  const inResizeMode = isSelected && editMode === 'resize';

  // Only attach dnd-kit drag listeners in move mode
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: widget.i,
    disabled: inResizeMode,
  });

  const widgetStyle = getWidgetStyle(widget);
  const contentStyle = getWidgetContentStyle(widget);
  const textClass = getTextColorClass(widget, '');
  const hasCustomBg = !!widget.backgroundColor;

  // Ring color: blue for move, orange for resize
  const ringClass = isSelected
    ? inResizeMode
      ? 'ring-2 ring-orange-500 ring-offset-2 z-[100]'
      : 'ring-2 ring-blue-500 ring-offset-2 z-[100]'
    : 'touch-manipulation';

  return (
    <div
      ref={setNodeRef}
      className={`relative ${inResizeMode ? '' : 'cursor-grab active:cursor-grabbing'} ${ringClass} ${isDragging ? 'opacity-30' : ''}`}
      style={{
        gridColumn: `${pos.x + 1} / span ${pos.w}`,
        gridRow: `${pos.y + 1} / span ${pos.h}`,
        // In move mode: disable browser scrolling so dnd-kit handles drag.
        // In resize mode: disable scrolling on handles (set per-handle below).
        // Unselected: keep touch-manipulation for normal scrolling.
        ...(inMoveMode ? { touchAction: 'none' } : {}),
        ...widgetStyle,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(widget.i); }}
      {...(inMoveMode ? listeners : {})}
      {...(inMoveMode ? attributes : {})}
    >
      {/* Border overlay — dashed for move, solid for resize (accessible: pattern + color) */}
      <div className={`absolute inset-0 z-10 border-2 ${
        isSelected
          ? inResizeMode ? 'border-solid border-orange-500' : 'border-dashed border-blue-500'
          : `border-dashed ${theme.borderDash}`
      } rounded-lg pointer-events-none`} />

      {/* Widget content — interactivity disabled in edit mode so a stray
          click on an internal link (e.g. the Travel widget's "Open the map →")
          can't navigate away mid-edit and discard unsaved layout changes.
          The outer wrapper still receives drag/select events because clicks
          bubble through pointer-events:none and the wrapper has its own
          onClick + dnd-kit listeners. */}
      <WidgetBgOverrideProvider value={{ hasCustomBg, textColor: widget.textColor, textOpacity: widget.textOpacity, gridLineOpacity: widget.gridLineOpacity, cellBackgroundColor: widget.cellBackgroundColor, cellBackgroundOpacity: widget.cellBackgroundOpacity }}>
        <div
          className={`h-full w-full overflow-hidden ${textClass}`}
          style={{ pointerEvents: 'none', ...contentStyle }}
        >
          {renderWidget(widget)}
        </div>
      </WidgetBgOverrideProvider>

      {/* Mode label — visible when selected */}
      {isSelected && !isDragging && (
        <div className={`absolute top-1 left-1/2 -translate-x-1/2 z-10 text-white rounded-full px-2 py-0.5 flex items-center gap-1 pointer-events-none text-[10px] font-medium shadow-sm ${
          inResizeMode ? 'bg-orange-500/90' : 'bg-blue-500/90'
        }`}>
          {inResizeMode ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              Resize
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
              </svg>
              Move
            </>
          )}
        </div>
      )}

      {/* Hint: tap again to switch mode */}
      {isSelected && !isDragging && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white rounded-full px-2 py-0.5 pointer-events-none text-[9px] shadow-sm whitespace-nowrap">
          Tap to {inResizeMode ? 'deselect' : 'resize'}
        </div>
      )}

      {/* Resize handles — only visible in resize mode, much larger for touch */}
      {inResizeMode && (
        <ResizeHandles widgetId={widget.i} onResizeStart={onResizeStart} />
      )}
    </div>
  );
}

// Resize handle hit areas + visual indicators
// Handles are only shown in resize mode, so they can be large for touch
const EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'se', 'sw'];
const HIT = 28; // hit area size — large for touch (px)
const CORNER_HIT = 48; // corner hit area (px) — meets Apple 44px minimum

const EDGE_HIT_STYLES: Record<ResizeEdge, React.CSSProperties> = {
  n:  { top: -HIT / 2, left: CORNER_HIT / 2, right: CORNER_HIT / 2, height: HIT, cursor: 'ns-resize' },
  s:  { bottom: -HIT / 2, left: CORNER_HIT / 2, right: CORNER_HIT / 2, height: HIT, cursor: 'ns-resize' },
  e:  { right: -HIT / 2, top: CORNER_HIT / 2, bottom: CORNER_HIT / 2, width: HIT, cursor: 'ew-resize' },
  w:  { left: -HIT / 2, top: CORNER_HIT / 2, bottom: CORNER_HIT / 2, width: HIT, cursor: 'ew-resize' },
  ne: { top: -CORNER_HIT / 2, right: -CORNER_HIT / 2, width: CORNER_HIT, height: CORNER_HIT, cursor: 'nesw-resize' },
  se: { bottom: -CORNER_HIT / 2, right: -CORNER_HIT / 2, width: CORNER_HIT, height: CORNER_HIT, cursor: 'nwse-resize' },
  sw: { bottom: -CORNER_HIT / 2, left: -CORNER_HIT / 2, width: CORNER_HIT, height: CORNER_HIT, cursor: 'nesw-resize' },
};

function ResizeHandles({ widgetId, onResizeStart }: {
  widgetId: string;
  onResizeStart: (widgetId: string, edge: ResizeEdge, e: React.PointerEvent) => void;
}) {
  return (
    <>
      {EDGES.map(edge => (
        <div
          key={edge}
          className="absolute z-20"
          style={{ ...EDGE_HIT_STYLES[edge], touchAction: 'none' }}
          onPointerDown={(e) => onResizeStart(widgetId, edge, e)}
        >
          {/* Visual dot for corners — large and visible */}
          {edge.length === 2 && (
            <div
              className="absolute bg-orange-500 rounded-full shadow-md border-2 border-white"
              style={{
                width: 18,
                height: 18,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
          {/* Visual bar for edges — thick and visible */}
          {edge.length === 1 && (
            <div
              className="absolute bg-orange-500/70 rounded-full"
              style={{
                ...(edge === 'n' || edge === 's'
                  ? { width: 56, height: 6, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
                  : { width: 6, height: 56, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
              }}
            />
          )}
        </div>
      ))}
    </>
  );
}
