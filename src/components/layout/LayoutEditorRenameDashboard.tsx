'use client';

interface RenameDashboardDialogProps {
  open: boolean;
  currentName: string;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function RenameDashboardDialog({
  open,
  currentName,
  value,
  onChange,
  onConfirm,
  onClose,
}: RenameDashboardDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-sm font-medium">Rename Dashboard</div>
        <div>
          <label className="text-xs text-muted-foreground">Name</label>
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-hidden focus:ring-2 focus:ring-primary"
            maxLength={100}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') onConfirm(); }}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!value.trim() || value.trim() === currentName}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
