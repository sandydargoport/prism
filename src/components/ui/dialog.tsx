/**
 *
 * A modal dialog component built on Radix UI Dialog.
 * Used for forms, confirmations, and focused content.
 *
 * USAGE:
 *   <Dialog open={isOpen} onOpenChange={setIsOpen}>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>Add Task</DialogTitle>
 *         <DialogDescription>Create a new task for your family.</DialogDescription>
 *       </DialogHeader>
 *       {children}
 *     </DialogContent>
 *   </Dialog>
 *
 */

'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isVirtualKeyboardTarget } from '@/lib/input/keyboardTarget';
import { lastPointerX, trackLastPointer } from '@/lib/input/lastPointer';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Where the last touch landed, so a sheet on the wall can open on that side
 * (#908): the left third opens it on the left, the right third on the right,
 * the middle from the bottom. Read once, when the sheet opens.
 */
trackLastPointer();

/** Where the sheet was opened from: the last tap, or the control that has focus. */
function openedAtX(): number | null {
  const x = lastPointerX();
  if (x !== null) return x;
  const el = typeof document === 'undefined' ? null : document.activeElement;
  if (!el || el === document.body) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 ? r.left + r.width / 2 : null;
}

export function sheetSide(x: number | null, width: number): 'left' | 'right' | 'bottom' {
  if (x === null || width <= 0) return 'bottom';
  if (x < width / 3) return 'left';
  if (x > (width * 2) / 3) return 'right';
  return 'bottom';
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onInteractOutside, ...props }, ref) => {
  // This wrapper renders while the sheet is closed too, so the side is set
  // when the sheet's element appears (before it is painted), and kept for
  // the life of that sheet: it does not jump if the next tap is elsewhere.
  const setSide = React.useCallback((el: HTMLDivElement | null) => {
    if (el && !el.dataset.sheetSide) el.dataset.sheetSide = sheetSide(openedAtX(), window.innerWidth);
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }, [ref]);
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={setSide}
      // Lifted above the on-screen keyboard while it is open (globals.css).
      data-keyboard-aware-dialog=""
      // One sheet (#908). On the wall it opens on the side that was touched
      // (globals.css, "Sheet").
      data-sheet=""
      // The on-screen virtual keyboard portals to <body>, outside this dialog.
      // Without this guard, tapping a key counts as an "outside" interaction and
      // Radix closes the dialog — so a keystroke into any dialog field would shut
      // the dialog and be lost. Ignore interactions that originate in the keyboard.
      onInteractOutside={(e) => {
        const t = (e.detail?.originalEvent?.target ?? null) as Element | null;
        if (isVirtualKeyboardTarget(t)) e.preventDefault();
        onInteractOutside?.(e);
      }}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg',
        'translate-x-[-50%] translate-y-[-50%] gap-4',
        // A solid warm sheet, no blur: the Paper card in light, warm near-black in dark.
        'bg-card dark:bg-[rgb(22_17_13)] p-8 shadow-2xl',
        'max-h-[85vh] md:max-h-[90vh] overflow-y-auto',
        'mb-16 md:mb-0',
        'duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        'rounded-[1.4rem]',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          // A 48px target in the corner, the icon small inside it.
          'absolute right-3 top-3 flex h-[48px] w-[48px] items-center justify-center rounded-full',
          'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none'
        )}
        data-sheet-close=""
      >
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Actions are pills along the bottom, 52px tall in a sheet (#908).
      'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&_button]:min-h-[52px]',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    style={{ fontFamily: 'var(--font-display)' }}
    className={cn(
      // The display face, as on the clock (#800, #908); room for the close button.
      'text-title font-medium leading-tight pr-12',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
