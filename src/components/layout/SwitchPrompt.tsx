'use client';

/**
 * Asked when the screen or the dashboard being edited changes while there are
 * changes Done has not saved (#1341): Save and switch, Discard, or Stay.
 * Closing the dialog any other way is Stay, so nothing is lost by accident.
 */
import { useCallback, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type SwitchChoice = 'save' | 'discard' | 'stay';

export function useSwitchPrompt() {
  const [state, setState] = useState<{ open: boolean; description: string }>({ open: false, description: '' });
  const resolveRef = useRef<((choice: SwitchChoice) => void) | null>(null);

  const ask = useCallback((description: string) => new Promise<SwitchChoice>((resolve) => {
    resolveRef.current = resolve;
    setState({ open: true, description });
  }), []);

  const choose = useCallback((choice: SwitchChoice) => {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(choice);
    resolveRef.current = null;
  }, []);

  return { ask, promptProps: { open: state.open, description: state.description, onChoose: choose } };
}

export function SwitchPrompt({ open, description, onChoose }: {
  open: boolean;
  description: string;
  onChoose: (choice: SwitchChoice) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onChoose('stay'); }}>
      <AlertDialogContent data-switch-prompt>
        <AlertDialogHeader>
          <AlertDialogTitle>Save before switching?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onChoose('stay')}>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={() => onChoose('discard')} className="bg-muted text-foreground hover:bg-muted/80">
            Discard
          </AlertDialogAction>
          <AlertDialogAction onClick={() => onChoose('save')}>Save and switch</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
