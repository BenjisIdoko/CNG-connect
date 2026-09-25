import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GasStation } from '../types';
import { searchTokens, stationMatchesQuery, stationSearchScore, normalizeSearch } from '../utils/stationSearch';
import { useBackLayer } from '../utils/backLayer';

interface StatusMeta {
  dot: string;
  label: string;
}

interface Props {
  stations: GasStation[];
  /** Real distance in km from the driver's GPS; 999 or more when unknown (never shown). */
  distanceKm: (st: GasStation) => number;
  /** What to list before the driver types (closest stations, or the home state's). */
  suggestions: GasStation[];
  suggestionsTitle: string;
  statusMeta: (st: GasStation) => StatusMeta;
  initialQuery: string;
  onPick: (st: GasStation) => void;
  /** Apply the typed text as a map filter ("Show all N on map"). */
  onApply: (query: string) => void;
  onClose: () => void;
}

const RECENT_KEY = 'cng_recent_stations';
const MAX_RECENT = 5;
const MAX_RESULTS = 30;

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function rememberRecentStation(id: string) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode: recents are a convenience only */
  }
}

/** Wraps the parts of `text` that match a typed word in <mark>-style bold. */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>;
  const lower = text.toLowerCase();
  const spans: Array<[number, number]> = [];
  for (const t of tokens) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(t, from);
      if (i === -1) break;
      spans.push([i, i + t.length]);
      from = i + t.length;
    }
  }
  if (spans.length === 0) return <>{text}</>;
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  const out: React.ReactNode[] = [];
  let pos = 0;
  merged.forEach(([a, b], i) => {
    if (a > pos) out.push(text.slice(pos, a));
    out.push(
      <strong key={i} className="font-extrabold text-on-surface">
        {text.slice(a, b)}
      </strong>,
    );
    pos = b;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}

const formatKm = (km: number) => (Number.isFinite(km) && km < 900 ? (km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`) : '');

export const StationSearchOverlay: React.FC<Props> = ({
  stations,
  distanceKm,
  suggestions,
  suggestionsTitle,
  statusMeta,
  initialQuery,
  onPick,
  onApply,
  onClose,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useBackLayer(true, onClose);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const tokens = useMemo(() => searchTokens(query), [query]);
  const searching = tokens.length > 0;

  const results = useMemo(() => {
    const list = searching
      ? stations
          .filter((st) => stationMatchesQuery(st, query))
          .sort(
            (a, b) =>
              stationSearchScore(b, query) - stationSearchScore(a, query) || distanceKm(a) - distanceKm(b),
          )
      : [];
    return list;
  }, [stations, query, searching]);

  const recent = useMemo(() => {
    const ids = readRecent();
    return ids.map((id) => stations.find((s) => s.id === id)).filter((s): s is GasStation => !!s);
  }, [stations]);

  const row = (st: GasStation) => {
    const meta = statusMeta(st);
    const place = [st.city, st.state].filter((v, i, a) => v && a.indexOf(v) === i && normalizeSearch(v) !== '').join(', ');
    const km = formatKm(distanceKm(st));
    return (
      <li key={st.id}>
        <button
          onClick={() => onPick(st)}
          className="w-full flex items-center gap-3 px-5 py-3 text-left active:bg-surface-container transition-colors"
        >
          <span className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant">
              local_gas_station
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-on-surface truncate">
              <Highlight text={st.name} tokens={tokens} />
            </span>
            <span className="flex items-center gap-1.5 text-caption text-outline">
              <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
              <span className="truncate">{[meta.label, place, km].filter(Boolean).join(' · ')}</span>
            </span>
          </span>
        </button>
      </li>
    );
  };

  const shown = results.slice(0, MAX_RESULTS);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search stations"
      className="fixed inset-0 z-[80] bg-white flex flex-col search-overlay-in"
    >
      <div className="pt-safe px-4 pb-3 border-b border-outline-variant/40 shrink-0">
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            aria-label="Close search"
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-on-surface active:bg-surface-container shrink-0"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <div className="flex-1 flex items-center bg-surface-container rounded-full px-4 gap-2 focus-within:ring-2 focus-within:ring-primary/40">
            <span aria-hidden="true" className="material-symbols-outlined text-outline text-[20px] shrink-0">search</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Search stations, city or state"
              placeholder="Station, city or state"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (shown.length === 1) onPick(shown[0]);
                  else if (shown.length > 1) onApply(query);
                }
              }}
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-body font-medium text-on-surface placeholder:text-outline py-3"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="p-1 rounded-full text-outline shrink-0"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain" aria-live="polite">
        {searching ? (
          shown.length > 0 ? (
            <>
              <p className="px-5 pt-4 pb-1 text-micro font-bold text-outline uppercase tracking-wide">
                {results.length} {results.length === 1 ? 'station' : 'stations'}
              </p>
              <ul>{shown.map(row)}</ul>
            </>
          ) : (
            <div className="px-8 pt-16 text-center">
              <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-outline">search_off</span>
              <h3 className="mt-2 font-extrabold text-body-lg text-on-surface">No station found</h3>
              <p className="mt-1 text-caption text-on-surface-variant">
                Nothing matches &ldquo;{query.trim()}&rdquo;. Try just the station name or the city.
              </p>
            </div>
          )
        ) : (
          <>
            <p className="px-5 pt-4 pb-1 text-micro font-bold text-outline uppercase tracking-wide">
              {suggestionsTitle}
            </p>
            <ul>{suggestions.map(row)}</ul>
            {recent.length > 0 && (
              <>
                <p className="px-5 pt-4 pb-1 text-micro font-bold text-outline uppercase tracking-wide">Recent</p>
                <ul>{recent.map(row)}</ul>
              </>
            )}
          </>
        )}
      </div>

      {searching && results.length > 1 && (
        <div className="shrink-0 px-5 py-3 pb-safe border-t border-outline-variant/40 bg-white">
          <button
            onClick={() => onApply(query)}
            className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-caption flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">map</span>
            Show all {results.length} on map
          </button>
        </div>
      )}
    </div>
  );
};
