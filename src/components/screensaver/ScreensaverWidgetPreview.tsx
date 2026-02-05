import { isLightColor } from '@/lib/utils/color';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

function getTextClass(widget: WidgetConfig, fallback: string) {
  if (!widget.backgroundColor) return fallback;
  return isLightColor(widget.backgroundColor) ? 'text-black' : 'text-white';
}

export function renderScreensaverPreview(widget: WidgetConfig) {
  const textClass = getTextClass(widget, 'text-white');

  switch (widget.i) {
    case 'clock':
      return (
        <div className={`h-full flex flex-col justify-end text-right p-3 ${textClass}`}>
          <div className="text-4xl font-light tabular-nums">12:00 <span className="text-lg opacity-70">PM</span></div>
          <div className="text-sm mt-1 opacity-60">Saturday, February 1</div>
        </div>
      );
    case 'weather':
      return (
        <div className={`h-full flex items-center justify-end p-3 ${textClass} opacity-80`}>
          <div className="text-2xl font-light">72°F</div>
          <div className="text-sm opacity-60 ml-2">Sunny</div>
        </div>
      );
    case 'messages':
      return (
        <div className={`h-full flex flex-col justify-end text-right p-3 ${textClass} opacity-80`}>
          <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Family Messages</div>
          <p className="text-sm opacity-70">Sample message text...</p>
          <p className="text-xs opacity-40 mt-0.5">&mdash; Family</p>
        </div>
      );
    case 'calendar':
      return (
        <div className={`h-full flex flex-col justify-end text-right p-3 ${textClass} opacity-80`}>
          <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Upcoming</div>
          <p className="text-sm opacity-70">Doctor appt @ 2pm</p>
          <p className="text-xs opacity-40 mt-0.5">Tomorrow</p>
        </div>
      );
    case 'birthdays':
      return (
        <div className={`h-full flex flex-col justify-end text-right p-3 ${textClass} opacity-80`}>
          <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Birthdays</div>
          <p className="text-sm opacity-70">Mom in 3 days</p>
        </div>
      );
    case 'tasks':
      return (
        <div className={`h-full flex flex-col justify-end text-right p-3 ${textClass} opacity-80`}>
          <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Tasks</div>
          <p className="text-sm opacity-70">Buy groceries</p>
          <p className="text-xs opacity-40 mt-0.5">3 more tasks</p>
        </div>
      );
    case 'chores':
      return (
        <div className={`h-full flex flex-col justify-end text-right p-3 ${textClass} opacity-80`}>
          <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Chores</div>
          <p className="text-sm opacity-70">Vacuum living room</p>
          <p className="text-xs opacity-40 mt-0.5">Due today</p>
        </div>
      );
    case 'shopping':
      return (
        <div className={`h-full flex flex-col justify-end text-right p-3 ${textClass} opacity-80`}>
          <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Shopping</div>
          <p className="text-sm opacity-70">Milk, Eggs, Bread</p>
          <p className="text-xs opacity-40 mt-0.5">5 items</p>
        </div>
      );
    case 'meals':
      return (
        <div className={`h-full flex flex-col justify-end text-right p-3 ${textClass} opacity-80`}>
          <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Tonight&apos;s Dinner</div>
          <p className="text-sm opacity-70">Pasta Primavera</p>
        </div>
      );
    case 'photos':
      return (
        <div className={`h-full flex flex-col justify-end text-right p-3 ${textClass} opacity-80`}>
          <div className="text-[10px] uppercase tracking-wider opacity-40 mb-1">Photos</div>
          <p className="text-sm opacity-70">Family slideshow</p>
        </div>
      );
    default:
      return <div className="text-white/50 p-3 text-sm">{widget.i}</div>;
  }
}
