import { GasStation, CommunityPost, ChatMessage, UserProfile, ConversionCenter } from '../types';
import pciStationsSeed from './pci-stations-seed.json';
import evStationsSeed from './ev-stations-seed.json';
import coreCngStationsSeed from './core-cng-stations-seed.json';

export const ASSETS = {
  logo: '/images/img-05.webp',
  userAvatar: '/images/img-14.webp',
  lagosMap: '/images/img-19.webp',
  abujaMap: '/images/img-04.webp',
  notificationMap: '/images/img-03.webp',
  
  // Cars and stations
  hondaAccord: '/images/img-06.webp',
  toyotaCamryListing: '/images/img-08.webp',
  cngEngineBay: '/images/img-15.webp',
  lekkiConstruction: '/images/img-02.webp',
  
  // Station images
  pumpMeter: '/images/img-09.webp',
  stationWide: '/images/img-16.webp',
  fuelNozzle: '/images/img-13.webp',
  pumpBlurred: '/images/img-01.webp',
  dispenserGreen: '/images/img-17.webp',
  totalCanopy: '/images/img-10.webp',

  // Avatars
  emmanuelAvatar: '/images/img-11.webp',
  davidAvatar: '/images/img-07.webp',
  ngoziAvatar: '/images/img-12.webp',
  babaAvatar: '/images/img-18.webp',
  obinnaAvatar: '/images/img-11.webp',
};

// Empty placeholder profile: the shape the app renders before a real
// Supabase session resolves (and the fallback avatar for rows with none).
// Not a real identity — every field is blank/zero until sign-in loads the
// driver's actual `profiles` row.
export const INITIAL_USER: UserProfile = {
  name: '',
  phone: '',
  email: '',
  avatar: ASSETS.userAvatar,
  vehicle: '',
  cngInstalledDate: '',
  monthlySavings: 0,
  reportsCount: 0,
  reputationScore: 0,
  communityPoints: 0,
  state: undefined,
};

export function deduplicateStations(stationsList: GasStation[]): GasStation[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  return stationsList.filter((st) => {
    const idKey = st.id;
    const normName = st.name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    if (seenIds.has(idKey) || seenNames.has(normName)) {
      return false;
    }
    seenIds.add(idKey);
    seenNames.add(normName);
    return true;
  });
}

// Temporary switch to pull EV charging stations out of the app entirely
// (map, lists, search, counts) without deleting their data — flip back to
// true to bring them back. Also honored in apiService.fetchStations() for
// the live/local-cache path.
export const SHOW_EV_STATIONS = false;

export const INITIAL_STATIONS: GasStation[] = deduplicateStations([
  ...(evStationsSeed as GasStation[]),
  ...(coreCngStationsSeed as GasStation[]),
  ...(pciStationsSeed as GasStation[]).map((s) => ({ ...s, stationType: (s.stationType || 'cng') as 'cng' })),
]).filter((s) => SHOW_EV_STATIONS || s.stationType !== 'ev_charging');

export const INITIAL_COMMUNITY_POSTS: CommunityPost[] = [];

export const INITIAL_POSTS = INITIAL_COMMUNITY_POSTS;

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [];

// Loaded on demand (~250 KB of JSON) — only the Kits tab needs it, so it stays
// out of the startup bundle. The service worker still precaches the chunk.
export const loadConversionCenters = (): Promise<ConversionCenter[]> =>
  import('./pci-conversion-centers-seed.json').then((m) => m.default as unknown as ConversionCenter[]);
