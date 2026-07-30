'use client';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { ScanState } from './useShoppingScanFlow';
import type { ShoppingList } from '@/types';

interface DynamicCategory { id: string; name: string }

interface ScanFlowSheetProps {
  scan: ScanState | null;
  lists: ShoppingList[];
  activeListId: string;
  dynamicCategories: DynamicCategory[];
  getCategoryEmoji: (cat: string) => string;
  onClear: () => void;
  onListChosen: (listId: string, listName: string) => void;
  onDoAdd: (category: string | null) => void;
}

export function ScanFlowSheet({
  scan,
  lists,
  activeListId,
  dynamicCategories,
  getCategoryEmoji,
  onClear,
  onListChosen,
  onDoAdd,
}: ScanFlowSheetProps) {
  if (!scan?.step) return null;

  if (scan.step === 'loading') {
    return (
      <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/40">
        <div className="bg-card rounded-2xl p-6 flex flex-col items-center gap-3 shadow-xl">
          <Spinner size="sm" />
          <p className="text-sm text-muted-foreground">Looking up product…</p>
        </div>
      </div>
    );
  }

  const product = scan.product;
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-[9100] flex items-end justify-center bg-black/60" onClick={onClear}>
      <div className="w-full max-w-lg bg-card rounded-t-2xl p-4 pb-8 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
        <p className="font-semibold text-center mb-1">{product.name}</p>
        {product.brand && <p className="text-sm text-muted-foreground text-center mb-3">{product.brand}</p>}

        {scan.step === 'list' && (
          <>
            <p className="text-sm text-muted-foreground text-center mb-3">Which list?</p>
            <div className="flex flex-col gap-2">
              {lists.map(list => (
                <Button key={list.id} variant={list.id === activeListId ? 'default' : 'outline'}
                  className="w-full justify-start text-base py-3"
                  onClick={() => onListChosen(list.id, list.name)}>
                  {list.name}
                </Button>
              ))}
            </div>
          </>
        )}

        {scan.step === 'duplicate' && (() => {
          const others = scan.existingInLists.filter(e => e.listId !== scan.targetListId);
          return (
            <>
              <p className="text-sm text-muted-foreground text-center mb-3">
                Already on <strong>{others.map(e => e.listName).join(', ')}</strong>.
                Add to <strong>{scan.targetListName}</strong> anyway?
              </p>
              <div className="flex flex-col gap-2">
                <Button className="w-full py-3" onClick={() => onDoAdd(null)}>
                  Yes, add to {scan.targetListName}
                </Button>
                <Button variant="outline" className="w-full py-3" onClick={onClear}>Cancel</Button>
              </div>
            </>
          );
        })()}

        {scan.step === 'category' && (
          <>
            <p className="text-sm text-muted-foreground text-center mb-3">Which category?</p>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {dynamicCategories.map(cat => (
                <Button key={cat.id}
                  variant={cat.id === product.suggestedCategory ? 'default' : 'outline'}
                  className="w-full justify-start text-base py-3 gap-2"
                  onClick={() => onDoAdd(cat.id)}>
                  <span>{getCategoryEmoji(cat.id)}</span>
                  <span>{cat.name}</span>
                  {cat.id === product.suggestedCategory && <span className="ml-auto text-xs opacity-60">suggested</span>}
                </Button>
              ))}
              <Button variant="ghost" className="w-full py-3 text-muted-foreground" onClick={() => onDoAdd(null)}>
                No category
              </Button>
            </div>
          </>
        )}

        <Button variant="ghost" className="w-full mt-2 text-muted-foreground" onClick={onClear}>Cancel</Button>
      </div>
    </div>
  );
}
