'use client';

import { useRef, useCallback, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export interface NoteEditorProps {
  dateKey: string;
  content: string;
  onNoteChange?: (date: string, content: string) => void;
  className?: string;
  placeholder?: string;
}

/**
 * Shared contentEditable note editor with auto-save, formatting shortcuts,
 * and DOMPurify sanitization. Used by CalendarNotesColumn, WeekVerticalView,
 * and DayViewSideBySide.
 */
export function NoteEditor({
  dateKey,
  content,
  onNoteChange,
  className,
  placeholder,
}: NoteEditorProps) {
  const t = useTranslations('calendar');
  const editable = !!onNoteChange;
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(content);

  // Set initial content on mount
  useEffect(() => {
    if (editorRef.current && content) {
      editorRef.current.innerHTML = DOMPurify.sanitize(content);
      lastSavedRef.current = content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external changes (only when editor isn't focused)
  useEffect(() => {
    if (editorRef.current && content !== lastSavedRef.current) {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = DOMPurify.sanitize(content);
        lastSavedRef.current = content;
      }
    }
  }, [content]);

  const save = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const isEmpty = !html || html === '<br>' || html.replace(/<br\s*\/?>/g, '').trim() === '';
    const value = isEmpty ? '' : html;
    if (value !== lastSavedRef.current) {
      lastSavedRef.current = value;
      onNoteChange?.(dateKey, value);
    }
  }, [dateKey, onNoteChange]);

  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(save, 2000);
  }, [save]);

  const handleBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    save();
  }, [save]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); document.execCommand('strikeThrough'); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') { e.preventDefault(); document.execCommand('insertUnorderedList'); }
  }, []);

  const handleBeforeInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const inputEvent = e.nativeEvent as InputEvent;
    if (inputEvent.inputType !== 'insertText' || inputEvent.data !== ' ') return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE && range.startOffset === 1 && node.textContent === '-') {
      e.preventDefault();
      node.textContent = '';
      document.execCommand('insertUnorderedList');
    }
  }, []);

  return (
    <div
      ref={editorRef}
      contentEditable={editable}
      suppressContentEditableWarning
      onInput={editable ? handleInput : undefined}
      onBlur={editable ? handleBlur : undefined}
      onKeyDown={editable ? handleKeyDown : undefined}
      onBeforeInput={editable ? handleBeforeInput : undefined}
      className={cn(
        'text-sm outline-hidden',
        editable && 'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none',
        className,
      )}
      data-placeholder={editable ? (placeholder ?? t('notesPlaceholder')) : undefined}
    />
  );
}
