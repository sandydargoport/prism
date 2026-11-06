/**
 * Where a clock or weather tile lines up its contents (#988).
 *
 * Auto: a small tile (a third of the width or less) touching a screen corner
 * (top or bottom row, and the left or right edge) hugs that corner, across and
 * up or down; anything else, a wide tile included, is centred both ways. A widget's `align` setting overrides either axis.
 */
export type AlignX = 'left' | 'center' | 'right';
export type AlignY = 'top' | 'middle' | 'bottom';
export type AlignSetting = { x?: AlignX | 'auto'; y?: AlignY | 'auto' };

export function tileAlign(
  tile: { x: number; y: number; w: number; h: number },
  cols: number,
  rows: number,
  setting?: AlignSetting | null,
): { x: AlignX; y: AlignY } {
  const side: AlignX | undefined = tile.x === 0 ? 'left' : tile.x + tile.w >= cols ? 'right' : undefined;
  const end: AlignY | undefined = tile.y === 0 ? 'top' : tile.y + tile.h >= rows ? 'bottom' : undefined;
  const small = tile.w * 3 <= cols;
  const corner = small && side && end ? { x: side, y: end } : { x: 'center' as const, y: 'middle' as const };
  return {
    x: setting?.x && setting.x !== 'auto' ? setting.x : corner.x,
    y: setting?.y && setting.y !== 'auto' ? setting.y : corner.y,
  };
}
