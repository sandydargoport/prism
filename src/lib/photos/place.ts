/**
 * A short place name for a photo's coordinates (#958), from OpenStreetMap's
 * public geocoder. Server-side only, and only called while the household has
 * turned on "Show where photos were taken": the coordinates leave the install
 * then and not otherwise. City level (zoom 10): a town, not a street.
 */
const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'Prism-Family-Dashboard/1.0 (https://github.com/sandydargoport/prism)';

interface NominatimAddress {
  city?: string; town?: string; village?: string; hamlet?: string; municipality?: string;
  county?: string; state?: string; country?: string; country_code?: string;
}

/** "Town, State" or "Town, Country"; null when nothing nameable. */
export function placeFromAddress(a: NominatimAddress | undefined): string | null {
  if (!a) return null;
  const local = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.county;
  const wider = a.state ?? a.country;
  if (local && wider && local !== wider) return `${local}, ${wider}`.slice(0, 120);
  return (local ?? wider ?? null)?.slice(0, 120) ?? null;
}

export async function reversePlace(lat: number, lon: number, locale = 'en'): Promise<string | null> {
  const url = new URL(ENDPOINT);
  // Rounded to about a kilometre: enough for a town, and less of the family's
  // exact whereabouts leaves the install.
  url.searchParams.set('lat', lat.toFixed(2));
  url.searchParams.set('lon', lon.toFixed(2));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '10');
  url.searchParams.set('accept-language', locale);
  const res = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const data = (await res.json()) as { address?: NominatimAddress };
  return placeFromAddress(data.address);
}
