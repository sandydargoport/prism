'use client';

/**
 * Over the editor's canvas (#1348): two small toggles, always there, that
 * say which of the screen's four states the canvas draws, In use | Idle and
 * Day | Night, and under it a line naming what is drawn. The canvas draws
 * that state as the wall would, from the scene the wall reads.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { remoteCanvasSlot } from '@/lib/displays/remoteEdit';
import { cn } from '@/lib/utils';

function Segmented<T extends string>({ label, value, options, onChange, data }: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (v: T) => void;
  data: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-muted p-1" data-canvas-toggle={data}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'min-h-[44px] rounded-full px-4 text-body font-medium transition-colors pointer-fine:min-h-8 pointer-fine:px-3 pointer-fine:text-caption',
            value === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
          data-canvas-pick={v}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** On the editor page above the picture, or here when there is no picture. */
function at(where: 'above' | 'below', node: React.ReactElement): React.ReactElement {
  const slot = remoteCanvasSlot(where);
  return slot ? createPortal(node, slot) : node;
}

export function CanvasToggles({ idle, night, onIdleChange, onNightChange }: {
  idle: boolean;
  night: boolean;
  onIdleChange: (idle: boolean) => void;
  onNightChange: (night: boolean) => void;
}) {
  return at('above', (
    <div className="flex flex-wrap items-center gap-3 pb-3" data-canvas-toggles>
      <Segmented
        label="In use or idle"
        data="use"
        value={idle ? 'idle' : 'in-use'}
        options={[['in-use', 'In use'], ['idle', 'Idle']] as const}
        onChange={(v) => onIdleChange(v === 'idle')}
      />
      <Segmented
        label="Day or night"
        data="time"
        value={night ? 'night' : 'day'}
        options={[['day', 'Day'], ['night', 'Night']] as const}
        onChange={(v) => onNightChange(v === 'night')}
      />
    </div>
  ));
}

export function CanvasCaption({ text }: { text: string }) {
  return at('below', (
    <p className="m-0 pt-2 text-body text-foreground" aria-live="polite" data-canvas-caption>{text}</p>
  ));
}
