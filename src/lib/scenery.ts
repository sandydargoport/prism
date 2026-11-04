/**
 * Landscape photographs bundled as wallpaper for new installs (#808), shown
 * until a household adds its own. All are US National Park Service works, in
 * the public domain; sources in public/scenery/CREDITS.md.
 */
export interface Scenery {
  id: string;
  src: string;
  title: string;
}

export const SCENERY: readonly Scenery[] = [
  { id: 'valley', src: '/scenery/valley.webp', title: 'Swiftcurrent Valley' },
  { id: 'river-sunset', src: '/scenery/river-sunset.webp', title: 'Sunset over the Firehole River' },
  { id: 'lake-clouds', src: '/scenery/lake-clouds.webp', title: 'Clearing storm on Yellowstone Lake' },
  { id: 'dunes-sunset', src: '/scenery/dunes-sunset.webp', title: 'Fall sunset over the dunes' },
  { id: 'forest-fog', src: '/scenery/forest-fog.webp', title: 'Lodgepole pine forest in the fog' },
  { id: 'morning-hills', src: '/scenery/morning-hills.webp', title: 'Morning light on the hills near Tower Junction' },
];

/** Household setting: show the bundled scenery while there are no wallpaper photos. */
export const SCENERY_SETTING_KEY = 'wallpaperScenery';
