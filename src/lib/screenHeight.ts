/**
 * The height a page can fill without the document scrolling, as `--screen-h`
 * on <html> (#1095).
 *
 * In the iPhone home-screen app 100vh and 100dvh both come out taller than the
 * area the document lays out in, by about the status bar, so a page sized from
 * them that fitted the screen still scrolled that far into empty space. The
 * root element's clientHeight is that area by definition: the document scrolls
 * only when its content is taller. It runs before the first paint and again on
 * every resize (rotation included); CSS falls back to 100dvh without it.
 */
export const SCREEN_HEIGHT_SCRIPT =
  "(function(){var d=document.documentElement;function s(){d.style.setProperty('--screen-h',d.clientHeight+'px')}s();addEventListener('resize',s)})()";
