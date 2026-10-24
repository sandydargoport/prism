'use client';

import { useState } from 'react';

interface Counts {
  listId: string;
  checked: number;
  total: number;
}

/**
 * Celebrate when the last item on a list is checked off.
 *
 * Compares each render's counts with the previous ones during render. Only a
 * rise in checked items on the same list, from a render that already had
 * items, ends in a celebration: opening a list that is already complete, or
 * its items arriving from the server complete, does not.
 */
export function useShoppingCelebration(activeListId: string, checkedItems: number, totalItems: number) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [prev, setPrev] = useState<Counts>({ listId: activeListId, checked: checkedItems, total: totalItems });

  if (prev.listId !== activeListId || prev.checked !== checkedItems || prev.total !== totalItems) {
    const completed = prev.listId === activeListId
      && prev.total > 0
      && prev.checked < checkedItems
      && totalItems > 0
      && checkedItems === totalItems;
    setPrev({ listId: activeListId, checked: checkedItems, total: totalItems });
    if (completed) setShowCelebration(true);
  }

  return {
    showCelebration,
    setShowCelebration,
  };
}
