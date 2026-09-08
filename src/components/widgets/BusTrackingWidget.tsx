'use client';

import * as React from 'react';
import { Bus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { useBusTracking } from '@/lib/hooks/useBusTracking';
import type { BusRouteStatus, BusPrediction } from '@/lib/hooks/useBusTracking';

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export interface BusTrackingWidgetProps {
  className?: string;
  gridW?: number;
  gridH?: number;
}

export const BusTrackingWidget = React.memo(function BusTrackingWidget({ className, gridW }: BusTrackingWidgetProps) {
  const { routes, allRoutes, loading, error } = useBusTracking();
  const isCompact = !gridW || gridW < 12;

  // In compact mode, show only the most relevant route (closest to scheduled time)
  const displayRoutes = isCompact ? getBestRoute(routes) : routes;

  return (
    <WidgetContainer
      title="Bus Tracker"
      icon={<Bus className="h-4 w-4" />}
      size="medium"
      loading={loading}
      error={error}
      className={className}
    >
      {allRoutes.length === 0 ? (
        <WidgetEmpty
          icon={<Bus className="h-8 w-8" />}
          message="No bus routes configured"
        />
      ) : displayRoutes.length === 0 ? (
        <WidgetEmpty
          icon={<Bus className="h-8 w-8" />}
          message="No routes active right now"
        />
      ) : (
        <div className="overflow-auto h-full -mr-2 pr-2 space-y-3">
          {displayRoutes.map((route) => (
            <RouteStatusCard key={route.id} route={route} compact={isCompact} />
          ))}
        </div>
      )}
    </WidgetContainer>
  );
});

// Build a flat ordered node list from a route for the train map
interface TrainNode {
  name: string;
  index: number;
  isStop: boolean;    // square shape — the ETA target
  isSchool: boolean;  // diamond shape — school terminal
  /**
   * True for the PM school diamond, which represents where the bus came FROM
   * rather than a checkpoint the bus will visit. FirstView does not emit a
   * "left school" email at the start of PM, so this node would never light up
   * via its own sortOrder — instead it is treated as reached the moment any
   * PM event has fired (i.e. lastCheckpointIndex >= 0).
   */
  isOrigin?: boolean;
}

function buildNodes(route: BusRouteStatus): TrainNode[] {
  const checkpoints = route.checkpoints || [];

  // FirstView emails come in three types: distance_based (intermediate stops),
  // arrived_at_stop (the family's home stop), arrived_at_school (the school).
  // Older data and manual edits can land "Home" / "School" inside the
  // `checkpoints` array as literal labels even though `stopName` / `schoolName`
  // also carry them — treat both cases as the same semantic terminal so we
  // don't render a square AND a diamond for the same stop.
  const isHomeCheckpoint = (cp: { name: string }) =>
    cp.name.toLowerCase() === 'home' ||
    (route.stopName != null && cp.name.toLowerCase() === route.stopName.toLowerCase());
  const isSchoolCheckpoint = (cp: { name: string }) =>
    cp.name.toLowerCase() === 'school' ||
    (route.schoolName != null && cp.name.toLowerCase() === route.schoolName.toLowerCase());

  const homeCp = checkpoints.find(isHomeCheckpoint) ?? null;
  const schoolCp = checkpoints.find(isSchoolCheckpoint) ?? null;
  const intermediates = checkpoints.filter(
    cp => !isHomeCheckpoint(cp) && !isSchoolCheckpoint(cp),
  );

  const intermediateNodes: TrainNode[] = intermediates.map(cp => ({
    name: cp.name,
    index: cp.sortOrder,
    isStop: false,
    isSchool: false,
  }));

  // Home terminal — labelled with the route's stopName (proper noun) when set,
  // since a literal "Home" checkpoint is just a placeholder for the family's
  // actual stop. Index reuses the checkpoint's sortOrder when present, else a
  // synthetic position past the intermediates (legacy implicit-terminal path).
  const homeNode: TrainNode | null = homeCp || route.stopName ? {
    name: route.stopName ?? homeCp!.name,
    index: homeCp ? homeCp.sortOrder : intermediates.length,
    isStop: true,
    isSchool: false,
  } : null;

  // School terminal (diamond) — labelled with schoolName when set.
  const schoolNode: TrainNode | null = schoolCp || route.schoolName ? {
    name: route.schoolName ?? schoolCp!.name,
    index: schoolCp ? schoolCp.sortOrder : intermediates.length + 1,
    isStop: false,
    isSchool: true,
  } : null;

  // Arrange by direction:
  //   AM — bus picks up at homes and ends at school: [intermediates, home, school]
  //   PM — bus leaves school and ends at the family's home: [school, intermediates, home]
  // PM intermediate stops are kept in stored sortOrder (the bus does not reverse
  // street direction between AM and PM — only the start/end terminals swap).
  if (route.direction === 'AM') {
    return [
      ...intermediateNodes,
      ...(homeNode ? [homeNode] : []),
      ...(schoolNode ? [schoolNode] : []),
    ];
  }

  return [
    ...(schoolNode ? [{ ...schoolNode, isOrigin: true }] : []),
    ...intermediateNodes,
    ...(homeNode ? [homeNode] : []),
  ];
}

function RouteStatusCard({ route, compact }: { route: BusRouteStatus; compact: boolean }) {
  const p = route.prediction;
  const statusColor = getStatusColor(p);
  const statusText = getStatusText(p);
  const nodes = buildNodes(route);

  return (
    <div className="space-y-1.5">
      {/* Header row: label + scheduled time */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{route.label}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
          {route.scheduledTime}
        </span>
      </div>

      {/* Status text with color indicator */}
      <div className="flex items-center gap-2">
        <div data-keep-bg className={cn('h-2 w-2 rounded-full flex-shrink-0', statusColor)} />
        <span className="text-xs text-muted-foreground">{statusText}</span>
      </div>

      {/* Train map — px-8 gives room for centered labels that extend ~26px each side */}
      {nodes.length > 0 && (
        <div className="px-8">
          <TrainMap nodes={nodes} prediction={p} compact={compact} statusColor={statusColor} />
        </div>
      )}

      {/* Last update info */}
      {p.lastCheckpointName && p.minutesSinceLastCheckpoint !== null && (
        <div className="text-[11px] text-muted-foreground">
          Last: {p.lastCheckpointName} ({formatMinutes(p.minutesSinceLastCheckpoint)} ago)
        </div>
      )}
    </div>
  );
}

function TrainMap({
  nodes,
  prediction,
  compact,
  statusColor,
}: {
  nodes: TrainNode[];
  prediction: BusPrediction;
  compact: boolean;
  statusColor: string;
}) {
  const lastIdx = prediction.lastCheckpointIndex;
  const labelHeight = compact ? 0 : 40;
  const nodeSize = compact ? 10 : 14;
  const trackY = Math.floor(nodeSize / 2) - 1;

  // Origin nodes (PM school diamond) light up the instant ANY event has fired,
  // since the bus came from there but FirstView doesn't emit a "left" email.
  const isReached = (node: TrainNode) =>
    node.isOrigin ? lastIdx >= 0 : node.index <= lastIdx;

  const isSegPassed = (from: TrainNode, to: TrainNode) => {
    if (from.isOrigin) return lastIdx >= 0;
    return from.index < lastIdx || (from.index === lastIdx && to.index <= lastIdx);
  };

  const renderNodeAt = (node: TrainNode, leftPct: number, topOffset: number) => {
    const reached = isReached(node);
    // Origin nodes never pulse — the bus has left them, it isn't *at* them.
    const current = !node.isOrigin && node.index === lastIdx && prediction.status !== 'no_data';
    const shapeBase = cn(
      'border-2 transition-all',
      reached
        ? cn(statusColor, statusColor.replace('bg-', 'border-'))
        : 'border-muted-foreground/40 bg-background',
      current && 'animate-pulse',
    );
    return (
      <div
        key={`node-${node.index}`}
        className="absolute flex flex-col items-center"
        style={{ left: `${leftPct}%`, transform: 'translateX(-50%)', top: topOffset, zIndex: 1 }}
      >
        {node.isSchool ? (
          <div data-keep-bg className={shapeBase}
            style={{ width: nodeSize, height: nodeSize, transform: 'rotate(45deg)', flexShrink: 0 }}
            title={node.name} />
        ) : node.isStop ? (
          <div data-keep-bg className={cn(shapeBase, 'rounded-sm')}
            style={{ width: nodeSize, height: nodeSize, flexShrink: 0 }}
            title={node.name} />
        ) : (
          <div data-keep-bg className={cn(shapeBase, 'rounded-full')}
            style={{ width: nodeSize, height: nodeSize, flexShrink: 0 }}
            title={node.name} />
        )}
        {!compact && (
          <div
            className="absolute text-[9px] leading-tight text-muted-foreground text-center pointer-events-none"
            style={{
              top: nodeSize + 3,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 56,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {node.name}
          </div>
        )}
      </div>
    );
  };

  // Reading-order 2-row layout for full mode with 6+ nodes:
  // top row left→right, bottom row left→right, U-turn connector on the right.
  if (!compact && nodes.length >= 6) {
    const half = Math.ceil(nodes.length / 2);
    const topNodes = nodes.slice(0, half);
    const botNodes = nodes.slice(half);
    const rowH = nodeSize + labelHeight;
    const connGap = 16;
    const totalH = rowH * 2 + connGap;

    // Both rows left→right
    const topPct = (i: number) =>
      topNodes.length <= 1 ? 50 : (i / (topNodes.length - 1)) * 100;
    const botPct = (i: number) =>
      botNodes.length <= 1 ? 0 : (i / (botNodes.length - 1)) * 100;

    const connPassed = botNodes.length > 0 && botNodes[0]!.index <= lastIdx;

    // U-turn connector geometry
    const connTopY = nodeSize / 2;           // centre of last top-row node
    const connMidY = rowH + connGap / 2;     // midpoint of gap between rows
    const connBotY = rowH + connGap + nodeSize / 2; // centre of first bottom-row node

    return (
      <div className="relative w-full select-none" style={{ height: totalH }}>
        {/* Top row segments */}
        {topNodes.map((node, i) => i < topNodes.length - 1 && (
          <div key={`ts-${i}`} data-keep-bg
            className={cn('absolute', isSegPassed(node, topNodes[i + 1]!) ? statusColor : 'bg-muted-foreground/25')}
            style={{ top: trackY, height: 2,
              left: `calc(${topPct(i)}% + ${nodeSize / 2}px)`,
              right: `calc(${100 - topPct(i + 1)}% + ${nodeSize / 2}px)` }}
          />
        ))}

        {/* Bottom row segments (left→right) */}
        {botNodes.map((node, i) => i < botNodes.length - 1 && (
          <div key={`bs-${i}`} data-keep-bg
            className={cn('absolute', isSegPassed(node, botNodes[i + 1]!) ? statusColor : 'bg-muted-foreground/25')}
            style={{ top: rowH + connGap + trackY, height: 2,
              left: `calc(${botPct(i)}% + ${nodeSize / 2}px)`,
              right: `calc(${100 - botPct(i + 1)}% + ${nodeSize / 2}px)` }}
          />
        ))}

        {/* U-turn connector — 1px, 60% opacity so node labels render in front */}
        <div data-keep-bg
          className={cn('absolute', connPassed ? statusColor : 'bg-muted-foreground/25')}
          style={{ top: connTopY, right: 0, width: 1, height: connMidY - connTopY, opacity: 0.6 }}
        />
        <div data-keep-bg
          className={cn('absolute', connPassed ? statusColor : 'bg-muted-foreground/25')}
          style={{ top: connMidY, left: 0, right: 0, height: 1, opacity: 0.6 }}
        />
        <div data-keep-bg
          className={cn('absolute', connPassed ? statusColor : 'bg-muted-foreground/25')}
          style={{ top: connMidY, left: 0, width: 1, height: connBotY - connMidY, opacity: 0.6 }}
        />

        {topNodes.map((node, i) => renderNodeAt(node, topPct(i), 0))}
        {botNodes.map((node, i) => renderNodeAt(node, botPct(i), rowH + connGap))}
      </div>
    );
  }

  // Single-row layout (compact mode or ≤5 nodes)
  return (
    <div className="relative w-full select-none" style={{ height: nodeSize + labelHeight + 2 }}>
      {nodes.map((node, i) => i < nodes.length - 1 && (
        <div key={`seg-${i}`} data-keep-bg
          className={cn('absolute', isSegPassed(node, nodes[i + 1]!) ? statusColor : 'bg-muted-foreground/25')}
          style={{ top: trackY, height: 2,
            left: `calc(${(i / (nodes.length - 1)) * 100}% + ${nodeSize / 2}px)`,
            right: `calc(${(1 - (i + 1) / (nodes.length - 1)) * 100}% + ${nodeSize / 2}px)` }}
        />
      ))}
      {nodes.map((node, i) =>
        renderNodeAt(node, nodes.length === 1 ? 50 : (i / (nodes.length - 1)) * 100, 0)
      )}
    </div>
  );
}

function getStatusColor(p: BusPrediction): string {
  switch (p.status) {
    case 'at_stop':
    case 'at_school':
      return 'bg-success';
    case 'in_transit':
    case 'cold_start':
      return 'bg-warning';
    case 'overdue':
      return 'bg-destructive';
    case 'no_data':
    default:
      return 'bg-muted-foreground/50';
  }
}

function getStatusText(p: BusPrediction): string {
  switch (p.status) {
    case 'at_stop':
      return 'Arrived at stop';
    case 'at_school':
      return 'Arrived at school';
    case 'in_transit':
      if (p.etaMinutes !== null) {
        if (p.etaRangeLow !== null && p.etaRangeHigh !== null && p.etaRangeLow !== p.etaRangeHigh) {
          return `${p.etaRangeLow}-${p.etaRangeHigh} min away`;
        }
        return `~${p.etaMinutes} min away`;
      }
      return 'In transit';
    case 'cold_start':
      if (p.lastCheckpointIndex === -1) {
        return 'Bus at school — en route';
      }
      if (p.lastCheckpointName && p.minutesSinceLastCheckpoint !== null) {
        return `${formatMinutes(p.minutesSinceLastCheckpoint)} ago at ${p.lastCheckpointName}`;
      }
      return 'In transit (building history)';
    case 'overdue':
      return 'Overdue — no updates';
    case 'no_data':
    default:
      return 'No updates yet';
  }
}

function getBestRoute(routes: BusRouteStatus[]): BusRouteStatus[] {
  if (routes.length === 0) return [];

  const now = new Date();

  const scored = routes.map(route => {
    const parts = route.scheduledTime.split(':').map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const scheduled = new Date(now);
    scheduled.setHours(h, m, 0, 0);
    const diff = Math.abs(now.getTime() - scheduled.getTime());
    return { route, diff };
  }).sort((a, b) => a.diff - b.diff);

  return [scored[0]!.route];
}
