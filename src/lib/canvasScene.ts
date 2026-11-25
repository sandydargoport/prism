import type { IdleSource } from './idleBackground';
import type { Scene } from './throughTheDay';

/**
 * What the editor's canvas draws (#1348), from the one scene the wall reads
 * (`screenStateAt`): the darkness over it, and the line under it that says
 * what is drawn.
 */

/** The canvas's two toggles, In use | Idle and Day | Night. */
export type CanvasToggles = { idle: boolean; night: boolean };

/**
 * The black the canvas draws over the screen, as the wall draws it: a screen
 * set to go off is black, and any other idle look at night is darker by the
 * screen's own level, whichever look it is. Null when nothing is drawn.
 */
export function canvasDarkness(scene: Pick<Scene, 'state' | 'look' | 'dim'>): { kind: 'off' | 'dim'; opacity: number } | null {
  if (scene.state === 'active') return null;
  if (scene.look === 'off') return { kind: 'off', opacity: 1 };
  return scene.dim > 0 ? { kind: 'dim', opacity: scene.dim } : null;
}

const LOOK_WORDS: Record<IdleSource, string> = {
  dashboard: 'the dashboard, quieter',
  photos: 'a photo frame',
  sky: 'the night sky',
  off: 'screen off',
};

/**
 * The line under the canvas, for example "Main, idle, at night: a photo
 * frame, 50% darker. 1280 x 800."
 */
export function canvasCaption({ name, scene, width, height, glance = false, saved = false }: {
  /** The dashboard the canvas shows. */
  name: string;
  scene: Pick<Scene, 'state' | 'night' | 'look' | 'dim'>;
  /** The screen's size, which the canvas is drawn at. */
  width: number;
  height: number;
  /** The dashboard is Glance, which has a night veil while in use. */
  glance?: boolean;
  /** Another dashboard, shown as it is saved rather than edited. */
  saved?: boolean;
}): string {
  const idle = scene.state !== 'active';
  const when = `${name}, ${idle ? 'idle' : 'in use'}, ${scene.night ? 'at night' : 'by day'}`;
  let what: string;
  if (!idle) {
    what = saved ? 'the dashboard as it is saved'
      : `the dashboard as someone using it sees it${glance && scene.night ? ', under its night veil' : ''}`;
  } else {
    const dark = canvasDarkness(scene);
    what = LOOK_WORDS[scene.look] + (dark?.kind === 'dim' ? `, ${Math.round(dark.opacity * 100)}% darker` : '');
  }
  const size = width > 0 && height > 0 ? ` ${width} x ${height}.` : '';
  return `${when}: ${what}.${size}`;
}
