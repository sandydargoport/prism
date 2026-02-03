'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const calendarColorOptions = [
  '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#F43F5E', '#0EA5E9', '#D946EF',
  '#FFFFFF', '#9CA3AF', '#6B7280', '#374151', '#000000',
];

export function CalendarColorPicker({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-5 h-5 rounded-full border-2 border-border hover:scale-110 transition-transform"
        style={{ backgroundColor: color }}
        title="Change color"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-5 left-0 z-20 bg-card border border-border rounded-lg p-2 shadow-lg">
            <div className="flex gap-1.5 flex-wrap w-[140px]">
              {calendarColorOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => { onChange(c); setOpen(false); }}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
