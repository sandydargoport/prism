'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Check, X, ExternalLink, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { parseShoppingQuantity, type ParsedShoppingQuantity } from '@/lib/utils/parseShoppingQuantity';
import type { ShoppingItem } from '@/types';

interface KrogerProductCandidate {
  productId: string;
  upc: string;
  brand?: string;
  description: string;
  size?: string;
  imageUrl?: string;
  price?: number;
  priceDisplay?: string;
}

type Dimension = 'weight' | 'volume' | 'count';

// Conversion to the canonical base unit of each dimension.
// Weight → ounces. Volume → fl oz. Count → count.
const TO_OZ: Record<string, number> = {
  oz: 1, lb: 16, g: 0.035274, kg: 35.274,
};
const TO_FLOZ: Record<string, number> = {
  floz: 1, ml: 0.033814, l: 33.814,
  cup: 8, pt: 16, qt: 32, gal: 128,
};

interface ParsedSize {
  value: number;
  unit: string;
  dimension: Dimension;
  /** Value expressed in the dimension's base unit (oz / fl oz / count). */
  valueInBase: number;
}

/**
 * Parse a Kroger size string ("16 oz", "1 lb", "12 ct", "2 lb / 32 oz") and
 * also classify the dimension + a base-unit value so callers can normalize
 * across candidates (e.g. always show $/lb regardless of native unit).
 */
function parseSize(size: string | undefined): ParsedSize | null {
  if (!size) return null;
  // Take the FIRST measurement chunk so "2 lb / 32 oz" yields "2 lb".
  const m = size.match(/(\d+(?:\.\d+)?)\s*(fl\s*oz|oz|lb|lbs?|g|kg|ml|l|cup|pt|pint|qt|quart|gal|gallon|ct|count|pk|pack)\b/i);
  if (!m) return null;
  const value = parseFloat(m[1]!);
  let unit = m[2]!.toLowerCase().replace(/\s+/g, '');
  if (unit === 'lbs') unit = 'lb';
  if (unit === 'count') unit = 'ct';
  if (unit === 'pack') unit = 'pk';
  if (unit === 'pint') unit = 'pt';
  if (unit === 'quart') unit = 'qt';
  if (unit === 'gallon') unit = 'gal';

  const ozFactor = TO_OZ[unit];
  if (ozFactor != null) {
    return { value, unit, dimension: 'weight', valueInBase: value * ozFactor };
  }
  const flozFactor = TO_FLOZ[unit];
  if (flozFactor != null) {
    return { value, unit, dimension: 'volume', valueInBase: value * flozFactor };
  }
  if (unit === 'ct' || unit === 'pk') {
    return { value, unit, dimension: 'count', valueInBase: value };
  }
  return null;
}

/**
 * For a set of candidates, return the dimension shared by the most of them.
 * Used to pick a single canonical unit per picker page so unit prices are
 * directly comparable rather than mixing $/oz against $/lb.
 */
function dominantDimension(candidates: KrogerProductCandidate[]): Dimension | null {
  const counts: Record<Dimension, number> = { weight: 0, volume: 0, count: 0 };
  for (const c of candidates) {
    const p = parseSize(c.size);
    if (p) counts[p.dimension]++;
  }
  const max = Math.max(counts.weight, counts.volume, counts.count);
  if (max === 0) return null;
  if (counts.weight === max) return 'weight';
  if (counts.volume === max) return 'volume';
  return 'count';
}

function formatPrice(value: number): string {
  // 2 decimals everywhere; cents are what matter for unit-price comparison.
  return value < 1 || value >= 10 ? value.toFixed(2) : value.toFixed(2);
}

/**
 * Display a unit price for a candidate, normalized to the page's canonical
 * dimension when this candidate matches it (so all weight candidates compare
 * as $/lb, all volume as $/fl oz, etc.). Candidates in a different dimension
 * fall back to their native unit so the row still shows something useful.
 */
function unitPriceDisplay(
  price: number | undefined,
  size: string | undefined,
  canonicalDim: Dimension | null,
): string | null {
  if (price == null) return null;
  const parsed = parseSize(size);
  if (!parsed || parsed.value <= 0) return null;

  if (canonicalDim && parsed.dimension === canonicalDim) {
    if (canonicalDim === 'weight') {
      return `$${formatPrice((price / parsed.valueInBase) * 16)}/lb`;
    }
    if (canonicalDim === 'volume') {
      return `$${formatPrice(price / parsed.valueInBase)}/fl oz`;
    }
    return `$${formatPrice(price / parsed.value)}/ct`;
  }

  // Fall back to native-unit per-price for mismatched-dimension outliers.
  return `$${formatPrice(price / parsed.value)}/${parsed.unit}`;
}

interface SearchResult {
  id: string;
  query: string;
  candidates: KrogerProductCandidate[];
  preselectedProductId?: string;
}

type PickState = Map<string, string | null>; // shoppingItemId -> selected productId (null = skip)

export interface KrogerCartModalProps {
  items: ShoppingItem[];
  onClose: () => void;
}

export function KrogerCartModal({ items, onClose }: KrogerCartModalProps) {
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [picks, setPicks] = useState<PickState>(new Map());
  // Per-item quantity to push to the Kroger cart. Defaults to 1; user can
  // bump up/down via the +/- buttons after picking a SKU.
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Editable-search-term state for the "search again" affordance.
  const [editQuery, setEditQuery] = useState('');
  const [retrying, setRetrying] = useState(false);

  // Pre-parse all items once: strip leading quantity/unit so the Kroger
  // search hits the noun ("flour", not "2 cups flour"). The original text
  // is shown in the picker so the user can see if multiples are needed.
  const parsedByItemId = useMemo(() => {
    const map = new Map<string, ParsedShoppingQuantity>();
    for (const item of items) map.set(item.id, parseShoppingQuantity(item.name));
    return map;
  }, [items]);

  // Fetch candidates for every item in parallel up front.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/integrations/kroger/products/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((i) => ({
              id: i.id,
              query: parsedByItemId.get(i.id)?.name ?? i.name,
              cachedProductId: i.krogerProductId ?? null,
            })),
          }),
        });
        if (cancelled) return;
        if (res.status === 401) {
          setAuthError(true);
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error(await res.text());

        const data = await res.json() as { results: SearchResult[] };
        setResults(data.results);

        // Initialize picks with the preselected productId for each item.
        const initial: PickState = new Map();
        for (const r of data.results) {
          initial.set(r.id, r.preselectedProductId ?? null);
        }
        setPicks(initial);
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : 'Failed to load Kroger products',
          variant: 'destructive',
        });
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Intentionally only run once on mount; items+parsed map are stable
    // for the lifetime of this modal instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = results[index];
  const total = results.length;

  // Pick a single canonical unit (lb / fl oz / ct) for the current item's
  // candidates so all unit prices on this page are directly comparable
  // rather than mixing $/oz with $/lb.
  const canonicalDim = useMemo(
    () => (current ? dominantDimension(current.candidates) : null),
    [current],
  );

  const summary = useMemo(() => {
    let added = 0;
    let skipped = 0;
    for (const v of picks.values()) {
      if (v) added++;
      else skipped++;
    }
    return { added, skipped };
  }, [picks]);

  const pickCurrent = (productId: string | null) => {
    if (!current) return;
    setPicks((prev) => {
      const next = new Map(prev);
      next.set(current.id, productId);
      return next;
    });
    // First time picking a SKU, seed quantity to 1 if not already set.
    if (productId) {
      setQuantities((prev) => {
        if (prev.has(current.id)) return prev;
        const next = new Map(prev);
        next.set(current.id, 1);
        return next;
      });
    }
  };

  const adjustQuantity = (delta: number) => {
    if (!current) return;
    setQuantities((prev) => {
      const next = new Map(prev);
      const curr = next.get(current.id) ?? 1;
      const updated = Math.max(1, Math.min(99, curr + delta));
      next.set(current.id, updated);
      return next;
    });
  };

  // Reset the editor whenever we land on a new item.
  useEffect(() => {
    setEditQuery(current?.query ?? '');
  }, [current?.id, current?.query]);

  const retrySearch = async () => {
    const query = editQuery.trim();
    if (!query || !current) return;
    setRetrying(true);
    try {
      const res = await fetch('/api/integrations/kroger/products/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: current.id, query, cachedProductId: null }],
        }),
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json() as { results: SearchResult[] };
      const updated = data.results[0];
      if (!updated) throw new Error('No result returned');
      setResults((prev) => prev.map((r, i) => (i === index ? updated : r)));
      setPicks((prev) => {
        const next = new Map(prev);
        next.set(current.id, updated.preselectedProductId ?? null);
        return next;
      });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : 'Search failed',
        variant: 'destructive',
      });
    } finally {
      setRetrying(false);
    }
  };

  const goNext = () => {
    if (index < total - 1) setIndex(index + 1);
    else setDone(true);
  };
  const goBack = () => {
    if (done) { setDone(false); return; }
    if (index > 0) setIndex(index - 1);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const selections = results
        .map((r) => {
          const productId = picks.get(r.id);
          if (!productId) return null;
          const cand = r.candidates.find((c) => c.productId === productId);
          if (!cand) return null;
          const quantity = quantities.get(r.id) ?? 1;
          return { shoppingItemId: r.id, productId: cand.productId, upc: cand.upc, quantity };
        })
        .filter((x): x is { shoppingItemId: string; productId: string; upc: string; quantity: number } => x !== null);

      if (selections.length === 0) {
        toast({ title: 'Nothing selected to send', variant: 'warning' });
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/integrations/kroger/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Cart add failed');
      }

      const data = await res.json() as { count: number };
      toast({ title: `Sent ${data.count} item${data.count === 1 ? '' : 's'} to your Kroger cart` });
      onClose();
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : 'Failed to send to Kroger',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // Render

  if (authError) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Kroger first</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Connect your Kroger / Mariano&apos;s account to send shopping items to your online cart.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button asChild>
              <a href="/api/auth/kroger">
                Connect Kroger <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <PageLoader size="sm" label="Searching Kroger…" className="py-10" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className={cn(
          // Mobile: tight horizontal padding so the candidate row's image +
          // name + price all fit on a ~390px iPhone width. Desktop reverts
          // to the cushy defaults.
          'max-w-lg p-3 sm:p-6 max-h-[90vh] overflow-y-auto',
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {done
              ? 'Review & send'
              : current
                ? `${index + 1} of ${total}: ${parsedByItemId.get(current.id)?.original ?? current.query}`
                : ''}
          </DialogTitle>
          {!done && current && parsedByItemId.get(current.id) && parsedByItemId.get(current.id)!.original !== parsedByItemId.get(current.id)!.name && (
            <p className="text-xs text-muted-foreground">
              Searching Kroger for &quot;{parsedByItemId.get(current.id)!.name}&quot;
            </p>
          )}
        </DialogHeader>

        {!done && current && (
          <div className="space-y-2 py-2">
            {/* Editable search query — always available so you can refine
                a wrong parse without skipping the whole item. */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={editQuery}
                  onChange={(e) => setEditQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') retrySearch(); }}
                  placeholder="Search Kroger…"
                  className="h-8 pl-7 text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retrySearch}
                disabled={retrying || !editQuery.trim() || editQuery.trim() === current.query}
              >
                {retrying ? '…' : 'Search'}
              </Button>
            </div>

            {current.candidates.length === 0 ? (
              <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                No Kroger matches found for &quot;{current.query}&quot;. Try editing the
                search above (e.g. shorten to the noun).
              </div>
            ) : (
              <ul className="space-y-2">
                {current.candidates.map((c) => {
                  const selected = picks.get(current.id) === c.productId;
                  return (
                    <li key={c.productId}>
                      <button
                        type="button"
                        onClick={() => pickCurrent(c.productId)}
                        className={cn(
                          'w-full flex items-stretch gap-2 sm:gap-3 rounded border p-2 text-left transition',
                          selected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50',
                        )}
                      >
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.imageUrl}
                            alt=""
                            className="h-12 w-12 sm:h-14 sm:w-14 object-contain rounded bg-white flex-shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded bg-muted flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          {/* Wrap name to 2 lines instead of truncating —
                              full product strings need to be readable on
                              narrow phone screens. */}
                          <div className="text-sm font-medium leading-tight line-clamp-2">
                            {c.brand ? `${c.brand} — ` : ''}{c.description}
                          </div>
                          {c.size && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">{c.size}</div>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end justify-center min-w-[3.5rem]">
                          {c.priceDisplay ? (
                            <>
                              <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{c.priceDisplay}</span>
                              {(() => {
                                const u = unitPriceDisplay(c.price, c.size, canonicalDim);
                                return u ? (
                                  <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">{u}</span>
                                ) : null;
                              })()}
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">no price</span>
                          )}
                        </div>
                        {selected && <Check className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 self-center" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={() => pickCurrent(null)}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded border border-dashed p-2 text-sm transition',
                picks.get(current.id) === null
                  ? 'border-destructive text-destructive bg-destructive/5'
                  : 'border-border text-muted-foreground hover:bg-muted/50',
              )}
            >
              <X className="h-4 w-4" />
              Skip this item
            </button>

            {/* Quantity adjuster — only meaningful once a SKU is selected.
                Default 1, capped 1-99. Sent to Kroger's cart-add as the
                `quantity` per UPC. */}
            {picks.get(current.id) && (
              <div className="flex items-center justify-between rounded border bg-muted/30 p-2">
                <span className="text-sm font-medium">Quantity</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => adjustQuantity(-1)}
                    disabled={(quantities.get(current.id) ?? 1) <= 1}
                    aria-label="Decrease quantity"
                  >
                    −
                  </Button>
                  <span className="min-w-[2rem] text-center text-base font-semibold tabular-nums">
                    {quantities.get(current.id) ?? 1}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => adjustQuantity(1)}
                    disabled={(quantities.get(current.id) ?? 1) >= 99}
                    aria-label="Increase quantity"
                  >
                    +
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {done && (
          <div className="space-y-3 py-2">
            <p className="text-sm">
              <span className="font-medium">{summary.added}</span> item{summary.added === 1 ? '' : 's'} ready to send
              {summary.skipped > 0 && (
                <>, <span className="font-medium">{summary.skipped}</span> skipped</>
              )}
              .
            </p>
            <ul className="max-h-60 overflow-y-auto space-y-1 text-sm border rounded p-2">
              {results.map((r) => {
                const pid = picks.get(r.id);
                const cand = pid ? r.candidates.find((c) => c.productId === pid) : null;
                return (
                  <li key={r.id} className="flex items-start gap-2 min-w-0">
                    {cand ? (
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-muted-foreground break-words">
                        {parsedByItemId.get(r.id)?.original ?? r.query}
                      </div>
                      {cand && (
                        <div className="text-xs text-muted-foreground break-words">
                          → {cand.brand ? `${cand.brand} ` : ''}{cand.description}
                          {(quantities.get(r.id) ?? 1) > 1 && (
                            <span className="ml-1 font-medium text-foreground">
                              × {quantities.get(r.id)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DialogFooter className="flex-row sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={!done && index === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {done ? (
            <Button onClick={submit} disabled={submitting || summary.added === 0}>
              {submitting ? 'Sending…' : `Send ${summary.added} to cart`}
            </Button>
          ) : (
            <Button onClick={goNext}>
              {index < total - 1 ? <>Next <ChevronRight className="h-4 w-4 ml-1" /></> : 'Review'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
