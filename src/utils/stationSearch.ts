import type { GasStation } from '../types';

type Searchable = Pick<GasStation, 'name' | 'address' | 'city' | 'state' | 'operator' | 'network' | 'area'>;

// Words a driver types that describe every result, so they must not filter anything out.
const STOP_WORDS = new Set(['cng', 'station', 'stations', 'the', 'in', 'at', 'near', 'gas']);

// Common ways people name the same place.
const ALIASES: Record<string, string[]> = {
  fct: ['abuja', 'federal capital territory'],
  abuja: ['fct'],
  phc: ['port harcourt'],
};

/** Lower-case, strip accents ("Ìbàdàn" -> "ibadan") and punctuation, collapse spaces. */
export function normalizeSearch(text: string | undefined | null): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function searchTokens(query: string): string[] {
  return normalizeSearch(query)
    .split(' ')
    .filter((t) => t && !STOP_WORDS.has(t));
}

function haystack(st: Searchable): string {
  return normalizeSearch([st.name, st.address, st.city, st.state, st.area, st.operator, st.network].filter(Boolean).join(' '));
}

/**
 * Every word the driver typed must appear somewhere in the station's name, address,
 * city, state, area, operator or network, in any order ("nnpc abuja" finds NNPC
 * stations in Abuja even though no single field contains that phrase).
 */
export function stationMatchesQuery(st: Searchable, query: string): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const text = haystack(st);
  const padded = ` ${text}`;
  // Short fragments ("ab" while typing "abuja") must start a word, so results narrow
  // as you type instead of matching the middle of unrelated words; 4+ letters may sit anywhere.
  const hit = (t: string) => (t.length >= 4 ? text.includes(t) : padded.includes(` ${t}`));
  return tokens.every((t) => hit(t) || (ALIASES[t] ?? []).some((a) => text.includes(a)));
}

/** Higher is a better match; used to order results while a search is active. */
export function stationSearchScore(st: Searchable, query: string): number {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return 0;
  const name = normalizeSearch(st.name);
  const phrase = tokens.join(' ');
  let score = 0;
  if (name.startsWith(phrase)) score += 100;
  else if (name.includes(phrase)) score += 60;
  const nameWords = name.split(' ');
  const placeWords = normalizeSearch(`${st.city} ${st.state}`).split(' ');
  for (const t of tokens) {
    if (nameWords.includes(t)) score += 12;
    else if (name.includes(t)) score += 8;
    if (placeWords.includes(t)) score += 5;
  }
  return score;
}
