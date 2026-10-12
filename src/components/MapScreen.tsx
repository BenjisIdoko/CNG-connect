import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { GasStation, StationStatus, StationSuggestion } from '../types';
import { Modal } from './common/Modal';
import { ASSETS, SHOW_EV_STATIONS } from '../data/mockData';
import { StationStatusChip } from './common/StationStatusChip';
import { getFreshness, describeStatus, freshnessRank, currentStatus } from '../utils/stationFreshness';
import { StationSearchOverlay, rememberRecentStation } from './StationSearchOverlay';
import { searchTokens, stationMatchesQuery, stationSearchScore } from '../utils/stationSearch';
import { SuggestStationModal } from './SuggestStationModal';
import { prefersReducedMotion } from '../utils/haptics';
import { getPinConfidence, getAccuracyRadiusM } from '../utils/locationPrecision';
import { isSameState } from '../utils/proximityAlertEngine';
import { track } from '../services/analytics';

// Bundle Leaflet's default marker assets through Vite so the map works offline
// and never depends on a third-party CDN at runtime.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export type GpsStatus = 'active' | 'denied' | 'unavailable';

interface MapScreenProps {
  stations: GasStation[];
  /** Driver's registered state. The map opens scoped to it, but any search
   *  or explicit city selection widens back to the full nationwide list. */
  homeState?: string;
  selectedStation: GasStation;
  onSelectStation: (station: GasStation) => void;
  onOpenStationDetails: (station: GasStation) => void;
  onNavigate: (station: GasStation) => void;
  gpsStatus?: GpsStatus;
  userGps?: { lat: number; lng: number } | null;
  onGpsStatusChange?: (status: GpsStatus, coords?: { lat: number; lng: number }) => void;
  onSuggestStation?: (suggestion: Omit<StationSuggestion, 'id' | 'createdAt' | 'status'>) => void;
  onShareApp?: () => void;
  /** Stations whose status just changed — they pulse briefly. */
  flashIds?: Set<string>;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  stations,
  homeState,
  selectedStation,
  onSelectStation,
  onOpenStationDetails,
  onNavigate,
  gpsStatus: propGpsStatus,
  userGps: propUserGps,
  onGpsStatusChange,
  onSuggestStation,
  onShareApp,
  flashIds,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [stationTypeFilter, setStationTypeFilter] = useState<'all' | 'cng' | 'ev_charging'>('all');
  // Desktop list order. 'auto' = nearest when we know where the driver is, otherwise the
  // stations with the freshest reports first (distance means nothing without a location).
  const [desktopSort, setDesktopSort] = useState<'auto' | 'nearest' | 'freshest'>('auto');
  const [activeCity, setActiveCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // Station the driver picked from search: shown first in the sheet and highlighted.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [showPiCngInfo, setShowPiCngInfo] = useState(false);
  const [sheetMode, setSheetMode] = useState<'standard' | 'expanded' | 'collapsed'>('standard');
  const toggleSheetMode = () => setSheetMode((prev) => (prev === 'expanded' ? 'standard' : 'expanded'));

  // ---- Bottom sheet: drag to collapse / expand, with a FLIP slide between heights ----
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const sheetHeightRef = useRef(0);
  const lastModeRef = useRef(sheetMode);
  const dragOffsetRef = useRef(0);
  const dragRef = useRef<{ startY: number; t: number; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const newH = el.offsetHeight;
    if (lastModeRef.current !== sheetMode && sheetHeightRef.current && !prefersReducedMotion()) {
      // The layout already jumped to the new height; start visually where the old top edge
      // was (plus any drag offset), then glide to the resting position.
      const start = newH - sheetHeightRef.current + dragOffsetRef.current;
      el.style.transition = 'none';
      el.style.transform = `translateY(${start}px)`;
      void el.offsetHeight; // commit the start position
      el.style.transition = 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      el.style.transform = '';
    }
    lastModeRef.current = sheetMode;
    dragOffsetRef.current = 0;
    sheetHeightRef.current = newH;
  }, [sheetMode]);

  const nextSheetMode = (dir: 'up' | 'down') => {
    if (dir === 'down') return sheetMode === 'expanded' ? 'standard' : 'collapsed';
    return sheetMode === 'collapsed' ? 'standard' : 'expanded';
  };
  const onSheetPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = { startY: e.clientY, t: Date.now(), moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic/unsupported pointer: dragging still works while over the handle */
    }
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };
  const onSheetPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || !sheetRef.current) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 6) d.moved = true;
    // 1:1 downward, rubber-banded upward
    const offset = dy > 0 ? dy : Math.max(-80, dy * 0.4);
    dragOffsetRef.current = offset;
    sheetRef.current.style.transform = `translateY(${offset}px)`;
  };
  const onSheetPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const fast = Math.abs(dy) / Math.max(1, Date.now() - d.t) > 0.5;
    if (!d.moved) {
      dragOffsetRef.current = 0;
      if (sheetRef.current) sheetRef.current.style.transform = '';
      toggleSheetMode();
      return;
    }
    if (dy > 70 || (fast && dy > 25)) setSheetMode(nextSheetMode('down'));
    else if (dy < -50 || (fast && dy < -25)) setSheetMode(nextSheetMode('up'));
    else if (sheetRef.current) {
      // not far enough: spring back
      dragOffsetRef.current = 0;
      sheetRef.current.style.transition = 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      sheetRef.current.style.transform = '';
    }
  };
  const [isRecentering, setIsRecentering] = useState(false);

  // Analytics: a search counts once the driver pauses typing (never the text itself).
  useEffect(() => {
    if (searchQuery.trim().length < 3) return;
    const t = setTimeout(() => track('search_used', { length: searchQuery.trim().length }), 1500);
    return () => clearTimeout(t);
  }, [searchQuery]);
  useEffect(() => {
    if (activeFilter !== 'all') {
      track('filter_applied', { status: activeFilter });
    }
  }, [activeFilter]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(25);

  const userGps = propUserGps || null;
  const gpsStatus = propGpsStatus || 'unavailable';
  const gpsStatusText =
    gpsStatus === 'active' && userGps
      ? `GPS Active: ${userGps.lat.toFixed(4)}°N, ${userGps.lng.toFixed(4)}°E`
      : gpsStatus === 'denied'
      ? 'Turn on location to find nearby stations'
      : 'GPS Location Unavailable (Showing Default)';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const initialFitRef = useRef(false);
  const userSelectedRef = useRef(false);

  const CITY_COORDINATES: Record<string, { lat: number; lng: number; zoom: number }> = {
    all: { lat: 9.0765, lng: 7.4853, zoom: 6 },
    abuja: { lat: 9.0765, lng: 7.4853, zoom: 12 },
    lagos: { lat: 6.5244, lng: 3.3792, zoom: 12 },
    rivers: { lat: 4.8156, lng: 7.0498, zoom: 12 },
    kano: { lat: 12.0022, lng: 8.5919, zoom: 12 },
    ogun: { lat: 6.9075, lng: 3.5813, zoom: 11 },
    edo: { lat: 6.3350, lng: 5.6037, zoom: 12 },
    oyo: { lat: 7.3775, lng: 3.9470, zoom: 12 },
    delta: { lat: 5.5442, lng: 5.7603, zoom: 11 },
    kaduna: { lat: 10.5105, lng: 7.4165, zoom: 12 },
  };
  const CITY_LABELS: Record<string, string> = {
    abuja: 'Abuja',
    lagos: 'Lagos',
    rivers: 'Rivers (Port Harcourt)',
    kano: 'Kano',
    ogun: 'Ogun',
    edo: 'Edo (Benin City)',
    oyo: 'Oyo (Ibadan)',
    delta: 'Delta',
    kaduna: 'Kaduna',
  };

  // GPS-unavailable fallback: give the driver a way to say where they actually are, and
  // explain why the map opened somewhere that may not match them. Only after a short grace
  // period, so it doesn't flash on every load while location is still being acquired.
  const [gpsGracePassed, setGpsGracePassed] = useState(false);
  const [areaBannerDismissed, setAreaBannerDismissed] = useState(false);
  const [isAreaPickerOpen, setIsAreaPickerOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGpsGracePassed(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const showAreaFallback = gpsGracePassed && gpsStatus !== 'active' && !areaBannerDismissed;

  const handleCitySelect = (cityId: string) => {
    setActiveCity(cityId);
    const cityInfo = CITY_COORDINATES[cityId];
    if (mapInstanceRef.current && cityInfo) {
      if (cityId === 'all') {
        if (userGps) {
          mapInstanceRef.current.flyTo([userGps.lat, userGps.lng], 13, { duration: 1.2 });
        } else {
          const matchCoords = stations.filter((s) => s.lat && s.lng).map((s) => [s.lat, s.lng] as [number, number]);
          if (matchCoords.length > 0) {
            mapInstanceRef.current.flyToBounds(L.latLngBounds(matchCoords), { padding: [50, 50], maxZoom: 12, duration: 1.2 });
          } else {
            mapInstanceRef.current.flyTo([cityInfo.lat, cityInfo.lng], cityInfo.zoom, { duration: 1.2 });
          }
        }
      } else {
        const cityStations = stations.filter(
          (s) =>
            s.state.toLowerCase().includes(cityId.toLowerCase()) ||
            s.city.toLowerCase().includes(cityId.toLowerCase())
        );
        if (cityStations.length > 0) {
          const bounds = L.latLngBounds(cityStations.map((s) => [s.lat, s.lng] as [number, number]));
          mapInstanceRef.current.flyToBounds(bounds, { padding: [40, 40], maxZoom: 13, duration: 1.2 });
        } else {
          mapInstanceRef.current.flyTo([cityInfo.lat, cityInfo.lng], cityInfo.zoom, { duration: 1.2 });
        }
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const calculateHaversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getDistanceKm = (st: GasStation): number => {
    if (userGps && st.lat && st.lng) {
      return calculateHaversineKm(userGps.lat, userGps.lng, st.lat, st.lng);
    }
    const match = st.distance.match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 999;
  };

  // Default view is scoped to the driver's home state, but the moment they
  // type a search term or pick a city the scope widens to every station so
  // cross-state search actually returns results.
  const baseStations = useMemo(() => {
    const scopeToHome = homeState && !searchQuery.trim() && activeCity === 'all';
    if (!scopeToHome) return stations;
    const inHome = stations.filter((st) => isSameState(st.state, homeState));
    return inHome.length > 0 ? inHome : stations;
  }, [stations, homeState, searchQuery, activeCity]);

  const matchesScope = (st: GasStation) => {
    const matchesStationType =
      stationTypeFilter === 'all' || (st.stationType || 'cng') === stationTypeFilter;
    const matchesCity =
      activeCity === 'all' ||
      st.state.toLowerCase().includes(activeCity.toLowerCase()) ||
      st.city.toLowerCase().includes(activeCity.toLowerCase());
    const matchesSearch = stationMatchesQuery(st, searchQuery);
    return matchesStationType && matchesCity && matchesSearch;
  };
  // Same scope as filteredStations but ignoring the status filter — what "All {n}" counts.
  const scopedCount = baseStations.filter(matchesScope).length;
  const filteredStations = baseStations.filter(
    (st) => matchesScope(st) && (activeFilter === 'all' || currentStatus(st) === activeFilter)
  );
  // While searching, best matches first (then nearest); otherwise keep the natural order.
  if (searchTokens(searchQuery).length > 0) {
    filteredStations.sort(
      (a, b) => stationSearchScore(b, searchQuery) - stationSearchScore(a, searchQuery) || getDistanceKm(a) - getDistanceKm(b),
    );
  }

  const effectiveDesktopSort: 'nearest' | 'freshest' = desktopSort === 'auto' ? (userGps ? 'nearest' : 'freshest') : desktopSort;
  // While searching, keep best-match order; otherwise apply the chosen sort.
  const desktopStations = searchTokens(searchQuery).length > 0
    ? filteredStations
    : [...filteredStations].sort((a, b) =>
        effectiveDesktopSort === 'nearest'
          ? getDistanceKm(a) - getDistanceKm(b)
          : freshnessRank(a) - freshnessRank(b) || getDistanceKm(a) - getDistanceKm(b),
      );
  const desktopLiveCount = filteredStations.filter((st) => {
    const tier = getFreshness(st).tier;
    return tier === 'fresh' || tier === 'recent';
  }).length;

  // Once the driver pauses typing, bring the matching stations into view.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || searchTokens(searchQuery).length === 0) return;
    const t = setTimeout(() => {
      const coords = filteredStations
        .filter((s) => s.lat != null && s.lng != null)
        .slice(0, 60)
        .map((s) => [s.lat!, s.lng!] as [number, number]);
      if (coords.length === 0) return;
      initialFitRef.current = true;
      // On phones the search bar covers the top and the station sheet the bottom.
      const phone = window.innerWidth < 1024;
      map.flyToBounds(L.latLngBounds(coords), {
        paddingTopLeft: [40, phone ? 190 : 60],
        paddingBottomRight: [40, phone ? 330 : 60],
        maxZoom: 14,
        duration: 0.8,
      });
    }, 450);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Opening view. Never the whole of West Africa: start on the driver's home state, or Abuja
  // when we don't know it, then move to the driver's own position as soon as GPS arrives
  // (unless they have already started moving the map themselves).
  // Fly to a point, placing it in the middle of the visible map on phones (the search sheet
  // covers the lower part of the screen, so the true map centre would sit right at its edge).
  const flyToVisibleCenter = (lat: number, lng: number, zoom: number, duration = 0.8) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    let target = L.latLng(lat, lng);
    if (window.innerWidth < 1024) {
      const p = map.project(target, zoom);
      target = map.unproject(L.point(p.x, p.y + 150), zoom);
    }
    map.flyTo(target, zoom, { duration });
  };
  const fitSourceRef = useRef<'none' | 'stations' | 'gps'>('none');
  const touchedRef = useRef(false);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || initialFitRef.current || touchedRef.current) return;
    if (userGps) {
      if (fitSourceRef.current === 'gps') return;
      fitSourceRef.current = 'gps';
      // Show the driver AND their few nearest stations, so there are pins in view straight away.
      const near = [...filteredStations]
        .filter((st) => st.lat != null && st.lng != null)
        .sort(
          (x, y) =>
            calculateHaversineKm(userGps.lat, userGps.lng, x.lat, x.lng) -
            calculateHaversineKm(userGps.lat, userGps.lng, y.lat, y.lng),
        )
        .slice(0, 3);
      const farKm = near.length ? calculateHaversineKm(userGps.lat, userGps.lng, near[near.length - 1].lat, near[near.length - 1].lng) : Infinity;
      if (near.length > 0 && farKm <= 60) {
        const phone = window.innerWidth < 1024;
        map.flyToBounds(L.latLngBounds([[userGps.lat, userGps.lng], ...near.map((st) => [st.lat, st.lng] as [number, number])]), {
          paddingTopLeft: [40, phone ? 90 : 50],
          paddingBottomRight: [40, phone ? 400 : 50],
          maxZoom: 14,
          duration: 0.8,
        });
      } else {
        flyToVisibleCenter(userGps.lat, userGps.lng, 13);
      }
      return;
    }
    if (fitSourceRef.current !== 'none') return;
    const inAbuja = filteredStations.filter((st) => isSameState(st.state, 'Abuja') || isSameState(st.state, 'FCT'));
    const pool = homeState || inAbuja.length === 0 ? filteredStations : inAbuja;
    const coords = pool.filter((s) => s.lat != null && s.lng != null).map((s) => [s.lat!, s.lng!] as [number, number]);
    if (coords.length === 0) return;
    fitSourceRef.current = 'stations';
    const phone = window.innerWidth < 1024;
    map.fitBounds(L.latLngBounds(coords), {
      paddingTopLeft: [30, phone ? 80 : 50],
      paddingBottomRight: [30, phone ? 400 : 50],
      maxZoom: 12,
      animate: false,
    });
  }, [filteredStations, userGps, homeState]);

  const nearestTop5Stations = [...filteredStations]
    .sort((a, b) => getDistanceKm(a) - getDistanceKm(b))
    .slice(0, 5);

  const nearestStation = nearestTop5Stations[0] || selectedStation || stations[0];

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = userGps ? [userGps.lat, userGps.lng] : [9.0765, 7.4853];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: userGps ? 14 : 13,
      zoomControl: false,
      attributionControl: false,
    });

    // Standard OpenStreetMap public tiles (free, no API key), light style.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const clusterGroup = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      iconCreateFunction: (cluster: any) => {
        const childCount = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="w-9 h-9 rounded-full bg-[#14201A] text-white font-extrabold text-[14px] flex items-center justify-center border-[3px] border-white shadow-[0_2px_8px_rgba(20,32,26,0.35)] transition-transform hover:scale-110"><span>${childCount}</span></div>`,
          className: 'custom-cluster-icon',
          iconSize: [36, 36],
        });
      },
    });

    markersLayerRef.current = clusterGroup;
    clusterGroup.addTo(map);
    mapInstanceRef.current = map;
    // Once the driver touches the map themselves, stop repositioning it automatically.
    map.getContainer().addEventListener('pointerdown', () => { touchedRef.current = true; }, { once: true });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Which marker should bounce (set when the selection changes) and whether the intro
  // fade has played. Computed during render so the marker effect below can read it.
  const bounceIdRef = useRef<string | null>(null);
  const prevSelectedIdRef = useRef<string | undefined>(undefined);
  if (prevSelectedIdRef.current !== selectedStation?.id) {
    if (prevSelectedIdRef.current !== undefined) bounceIdRef.current = selectedStation?.id ?? null;
    prevSelectedIdRef.current = selectedStation?.id;
  }
  const markersIntroDoneRef = useRef(false);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    filteredStations.forEach((st) => {
      const lat = st.lat || 9.0765;
      const lng = st.lng || 7.4853;
      const isSelected = selectedStation?.id === st.id;
      const isEv = st.stationType === 'ev_charging';

      // A report older than 24h (or none at all) is shown grey: a confident green pin for a
      // station nobody has reported on in days is worse than no colour.
      const freshness = getFreshness(st);
      const liveStatus = freshness.tier === 'fresh' || freshness.tier === 'recent' ? freshness.lastKnownStatus : null;
      let colorClass = '#8B9389';
      const iconSymbol = isEv ? 'bolt' : 'local_gas_station';
      if (liveStatus === 'full') colorClass = '#12A150';
      if (liveStatus === 'queue') colorClass = '#E0A106';
      if (liveStatus === 'low') colorClass = '#E0600B';
      if (liveStatus === 'out') colorClass = '#D92D20';

      // Precision tier drives the pin's confidence: exact pins are solid glowing
      // dots, approximate ones are hollow/dashed with an accuracy ring.
      const confidence = getPinConfidence(st.locationPrecision);
      const isApprox = confidence !== 'confident';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="relative flex items-center justify-center" style="width:40px;height:40px;" title="${isApprox ? 'Approximate location' : ''}">
            ${isApprox ? '<div style="position:absolute;inset:0;border:1.5px dashed ${colorClass}99;border-radius:9999px"></div>' : ''}
            ${flashIds?.has(st.id) ? `<div class="marker-ring" style="--ring:${colorClass}"></div>` : ''}
            <div class="rounded-full flex items-center justify-center transition-transform ${isSelected ? 'scale-125' : ''} ${bounceIdRef.current === st.id ? 'marker-bounce' : ''}" style="width:30px;height:30px;background:${isApprox ? '#ffffff' : colorClass};border:${isApprox ? '2.5px dashed ' + colorClass : '3px solid #ffffff'};box-shadow:0 2px 8px rgba(31,41,35,0.35), 0 0 0 4px ${colorClass}${isApprox ? '00' : '44'}${isSelected ? ', 0 0 0 7px rgba(31,41,35,0.85)' : ''};">
              <span aria-hidden="true" class="material-symbols-outlined" style="font-size:15px;color:${isApprox ? colorClass : '#fff'}">${iconSymbol}</span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      // Leaflet gives every marker a keyboard-focusable role="button" div regardless of
      // icon type, but only sets its `alt` option when the icon is an <img> — a divIcon
      // (ours) is a plain <div>, so without this it has no accessible name at all, and a
      // screen reader falls back to the icon glyph's raw text ("local_gas_station"). Its
      // `title` option, unlike `alt`, is applied to any icon type and doubles as the name.
      const markerLabel = [st.name, st.area || st.city, describeStatus(st)]
        .filter(Boolean)
        .join(', ');
      const marker = L.marker([lat, lng], { icon: customIcon, title: markerLabel });
      marker.on('click', () => {
        userSelectedRef.current = true;
        setPinnedId(st.id);
        onSelectStation(st);
        setSheetMode('standard');
      });

      if (isSelected) {
        // Name bubble above the selected pin; tapping it opens the station.
        const label = document.createElement('div');
        label.className = 'pin-label-inner';
        const t = document.createElement('div');
        t.className = 'pin-label-title';
        t.textContent = st.name;
        const sub = document.createElement('div');
        sub.className = 'pin-label-sub';
        sub.textContent = [getStatusIndicator(st.status).shortLabel, st.city].filter(Boolean).join(' · ');
        label.append(t, sub);
        marker.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -24], className: 'cng-pin-label', interactive: true });
        marker.on('tooltipopen', (ev: L.TooltipEvent) => {
          ev.tooltip.getElement()?.addEventListener('click', () => onOpenStationDetails(st));
        });
      }

      markersLayerRef.current?.addLayer(marker);
    });

    bounceIdRef.current = null;
    if (!markersIntroDoneRef.current && filteredStations.length > 0) {
      // One-time fade/rise of the whole marker layer on first render.
      markersIntroDoneRef.current = true;
      const container = mapInstanceRef.current.getContainer();
      container.classList.add('markers-intro');
      window.setTimeout(() => container.classList.remove('markers-intro'), 800);
    }

  }, [filteredStations, selectedStation, flashIds]);

  // The driver's own position: a blue dot with a soft pulse, kept out of the station clusters.
  const userMarkerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!userGps) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userGps.lat, userGps.lng]);
    } else {
      userMarkerRef.current = L.marker([userGps.lat, userGps.lng], {
        icon: L.divIcon({ className: 'user-dot', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [userGps]);

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedStation) return;
    if (userSelectedRef.current && selectedStation.lat && selectedStation.lng) {
      // Zoom in when the whole country is showing; keep the current zoom once close.
      const map = mapInstanceRef.current;
      const zoom = Math.max(map.getZoom(), 14);
      let target = L.latLng(selectedStation.lat, selectedStation.lng);
      if (window.innerWidth < 1024) {
        // Phones: the search bar covers the top and the sheet the bottom; centre the pin between them.
        const p = map.project(target, zoom);
        target = map.unproject(L.point(p.x, p.y + 90), zoom);
      }
      map.flyTo(target, zoom, { duration: 0.8 });
    }
  }, [selectedStation]);

  // Accuracy-radius circle: only for the selected pin, and only when its
  // precision tier isn't confident — showing this for all ~90 stations at
  // once would just be map clutter, but for the one the driver is looking at
  // it honestly communicates "the pump could be anywhere in this circle".
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (accuracyCircleRef.current) {
      map.removeLayer(accuracyCircleRef.current);
      accuracyCircleRef.current = null;
    }

    if (!selectedStation || !selectedStation.lat || !selectedStation.lng) return;
    if (getPinConfidence(selectedStation.locationPrecision) === 'confident') return;

    const circle = L.circle([selectedStation.lat, selectedStation.lng], {
      radius: getAccuracyRadiusM(selectedStation),
      color: '#FF6D00',
      weight: 1.5,
      dashArray: '6 6',
      fillColor: '#FF6D00',
      fillOpacity: 0.08,
      interactive: false,
    });
    circle.addTo(map);
    accuracyCircleRef.current = circle;

    return () => {
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
    };
  }, [selectedStation]);

  // Only reacts when the city selection actually changes (the opening view is handled above).
  const prevCityRef = useRef(activeCity);
  useEffect(() => {
    if (prevCityRef.current === activeCity) return;
    prevCityRef.current = activeCity;
    if (!mapInstanceRef.current) return;
    const cityKey = activeCity.toLowerCase();
    const cityInfo = CITY_COORDINATES[cityKey];

    if (cityKey !== 'all' && cityInfo) {
      mapInstanceRef.current.flyTo([cityInfo.lat, cityInfo.lng], cityInfo.zoom, { duration: 1.2 });
    } else if (cityKey === 'all' && userGps) {
      flyToVisibleCenter(userGps.lat, userGps.lng, 13, 1.2);
    }
  }, [activeCity, userGps]);

  const handleRecenter = () => {
    setIsRecentering(true);

    if (gpsStatus === 'active' && userGps) {
      flyToVisibleCenter(userGps.lat, userGps.lng, 14, 1);
    } else if (gpsStatus === 'denied') {
      showToast('Turn on location to find nearby stations');
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([9.0765, 7.4853], 13);
      }
    } else {
      showToast("Couldn't get your location — showing default view");
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([9.0765, 7.4853], 13);
      }
    }

    setTimeout(() => setIsRecentering(false), 600);
  };

  // Colors/icon per the 2026-10 redesign's 4-status system (design_handoff_cng_connect_mobile).
  const getStatusIndicator = (status: StationStatus) => {
    switch (status) {
      case 'full':
        return {
          barColor: 'bg-rd-available',
          badgeBg: 'bg-rd-available-container border-transparent text-rd-on-available-container',
          dotColor: 'bg-rd-available',
          solidBg: 'bg-rd-available',
          iconColor: 'text-rd-available',
          icon: 'check_circle',
          shortLabel: 'Available',
          label: 'Full stock',
        };
      case 'queue':
        return {
          barColor: 'bg-rd-queuing',
          badgeBg: 'bg-rd-queuing-container border-transparent text-rd-on-queuing-container',
          dotColor: 'bg-rd-queuing',
          solidBg: 'bg-rd-queuing',
          iconColor: 'text-rd-queuing',
          icon: 'schedule',
          shortLabel: 'Queuing',
          label: 'Queuing',
        };
      case 'low':
        return {
          barColor: 'bg-rd-low',
          badgeBg: 'bg-rd-low-container border-transparent text-rd-on-low-container',
          dotColor: 'bg-rd-low',
          solidBg: 'bg-rd-low',
          iconColor: 'text-rd-low',
          icon: 'speed',
          shortLabel: 'Low pressure',
          label: 'Low pressure',
        };
      case 'out':
        return {
          barColor: 'bg-rd-out',
          badgeBg: 'bg-rd-out-container border-transparent text-rd-on-out-container',
          dotColor: 'bg-rd-out',
          solidBg: 'bg-rd-out',
          iconColor: 'text-rd-out',
          icon: 'block',
          shortLabel: 'Out of service',
          label: 'Out of gas',
        };
      case 'unknown':
      default:
        return {
          barColor: 'bg-slate-400',
          badgeBg: 'bg-rd-stale-container border-transparent text-rd-on-stale-container',
          dotColor: 'bg-slate-400',
          solidBg: 'bg-surface-container-high text-outline!',
          iconColor: 'text-outline',
          icon: 'help',
          shortLabel: 'No recent report',
          label: 'No recent reports',
        };
    }
  };

  // True only when at least one visible station carries a real driver report
  // (anything other than 'unknown'). Drives whether the "live" pulse shows.
  const handlePickFromSearch = (st: GasStation) => {
    rememberRecentStation(st.id);
    track('search_used', { picked: true });
    setIsSearchOpen(false);
    setPinnedId(st.id);
    userSelectedRef.current = true;
    onSelectStation(st);
    setSheetMode('standard');
    initialFitRef.current = true;
  };

  const handleApplySearch = (q: string) => {
    setSearchQuery(q);
    setPinnedId(null);
    setIsSearchOpen(false);
  };

  // Plain list row in the style of ride-hailing apps: icon, name, one quiet line, and a
  // navigate button. The whole row opens the station.
  const renderPhoneRow = (station: GasStation) => {
    const freshness = getFreshness(station);
    const dotColor =
      freshness.tier === 'fresh' || freshness.tier === 'recent'
        ? getStatusIndicator(freshness.lastKnownStatus ?? 'unknown').dotColor
        : 'bg-slate-400';
    const isPinned = pinnedId === station.id;
    const open = () => {
      onSelectStation(station);
      onOpenStationDetails(station);
    };
    return (
      <div
        key={station.id}
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        className={`flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-2xl cursor-pointer active:bg-surface-container transition-colors ${isPinned ? 'bg-primary-container/50' : ''} ${flashIds?.has(station.id) ? 'flash-ring' : ''}`}
      >
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-surface-container-high">
          <img src={station.images?.[0] || ASSETS.stationWide} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-geist font-semibold text-[0.9375rem] text-rd-ink truncate leading-snug">{station.name}</h3>
          <p className="text-caption text-outline truncate flex items-center gap-1.5 mt-0.5">
            <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
            <span className="truncate">
              {[describeStatus(station), userGps && station.distance ? station.distance : null, station.city]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(station);
          }}
          aria-label={`Navigate to ${station.name}`}
          className="w-10 h-10 rounded-full bg-surface-container text-rd-ink flex items-center justify-center active:scale-95 shrink-0"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">navigation</span>
        </button>
      </div>
    );
  };

  // The single prominent "nearest station" hero card at the top of the standard sheet —
  // ink surface, per design_handoff_cng_connect_mobile screen 3b. No report yet today
  // doubles as the incentive-to-report moment (ghost pill + points).
  const renderNearestCard = (station: GasStation) => {
    // A report older than 24h is no longer "today's" status: show it as last-known and ask for a fresh one.
    const freshness = getFreshness(station);
    const isLive = freshness.tier === 'fresh' || freshness.tier === 'recent';
    const info = getStatusIndicator(isLive && freshness.lastKnownStatus ? freshness.lastKnownStatus : 'unknown');
    const isPinned = pinnedId === station.id;
    const noReportToday = !isLive;
    const openDetails = () => {
      onSelectStation(station);
      onOpenStationDetails(station);
    };
    return (
      // The card contains its own "Go" button, so the card itself can't be a button (a button
      // can't validly contain another, nor can role="button"). The station name is the one
      // real button; its ::after stretches over the whole card so tapping anywhere opens the
      // station, and "Go" sits above that overlay as a sibling.
      <div
        key={station.id}
        className={`relative w-full bg-rd-ink rounded-[22px] overflow-hidden text-left active:scale-[0.98] transition-transform ${
          flashIds?.has(station.id) ? 'flash-ring' : ''
        } ${isPinned ? 'ring-2 ring-primary' : ''}`}
      >
        <div className="flex gap-3 p-3">
          <div className="w-[84px] h-[84px] rounded-2xl overflow-hidden shrink-0 bg-rd-ink-2">
            <img src={station.images?.[0] || ASSETS.stationWide} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
            <p className="font-geist-mono text-[11px] font-medium tracking-[0.08em] uppercase text-[#B4BAC4] truncate">
              Nearest{userGps && station.distance ? ` · ${station.distance}` : ''}{station.driveTime ? ` · ${station.driveTime}` : ''}
            </p>
            <h3 className="font-geist font-bold text-[1.0625rem] leading-snug text-white line-clamp-2">
              <button
                type="button"
                onClick={openDetails}
                className="text-left after:absolute after:inset-0 after:rounded-[22px] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-white"
              >
                {station.name}
              </button>
            </h3>
            <span className="inline-flex self-start items-center gap-1.5 rounded-lg bg-rd-ink-2 border border-rd-ink-border px-2 py-1 text-[0.75rem] font-semibold text-white/85">
              <span aria-hidden="true" className={`material-symbols-outlined text-[13px] ${info.iconColor || ''}`}>
                {freshness.tier === 'stale' ? 'history' : info.icon}
              </span>
              {describeStatus(station)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 pb-3">
          {noReportToday && (
            <span className="flex-1 min-w-0 inline-flex items-center gap-1.5 rounded-full bg-rd-ink-2 text-white/90 text-[0.75rem] font-semibold pl-3 pr-2 py-2 truncate">
              <span aria-hidden="true" className="material-symbols-outlined text-[15px] shrink-0">campaign</span>
              <span className="truncate">First report today</span>
              <span className="ml-auto shrink-0 text-[0.6875rem] font-bold text-white/60">+10</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => onNavigate(station)}
            aria-label={`Navigate to ${station.name}`}
            className={`relative z-10 shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary text-white text-[0.8125rem] font-bold px-4 py-2 active:scale-95 transition-transform ${
              noReportToday ? '' : 'flex-1 justify-center'
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">directions</span>
            Go
          </button>
        </div>
      </div>
    );
  };

  // Plain row for the rest of the standard-mode list (below the nearest card): small photo
  // thumbnail, name, solid status chip, distance — per design_handoff_cng_connect_mobile 3b.
  const renderCompactRow = (station: GasStation) => {
    const isPinned = pinnedId === station.id;
    return (
      <button
        key={station.id}
        onClick={() => {
          onSelectStation(station);
          onOpenStationDetails(station);
        }}
        className={`w-full flex items-center gap-3 py-2.5 text-left active:bg-surface-container rounded-xl transition-colors ${
          flashIds?.has(station.id) ? 'flash-ring' : ''
        } ${isPinned ? 'bg-primary-container/40' : ''}`}
      >
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-surface-container-high">
          <img src={station.images?.[0] || ASSETS.stationWide} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-geist font-semibold text-[0.9375rem] text-rd-ink truncate">{station.name}</h3>
          <StationStatusChip station={station} className="mt-1" />
        </div>
        {userGps && station.distance && (
          <span className="shrink-0 text-[0.8125rem] font-semibold text-rd-text-tertiary">{station.distance}</span>
        )}
      </button>
    );
  };

  const statusChips: Array<{ key: string; label: string; full: string; icon: string | null; iconColor: string }> = [
    { key: 'all', label: `All ${scopedCount}`, full: 'All stations', icon: null, iconColor: '' },
    { key: 'full', label: 'Available', full: 'Available', icon: 'check_circle', iconColor: 'text-rd-available' },
    { key: 'queue', label: 'Queuing', full: 'Queuing', icon: 'schedule', iconColor: 'text-rd-queuing' },
    { key: 'low', label: 'Low', full: 'Low pressure', icon: 'speed', iconColor: 'text-rd-low' },
  ];


  // Closest stations for the search page: to the driver's GPS, or else to the middle of the map.
  const closestSuggestions = isSearchOpen
    ? (() => {
        const c = mapInstanceRef.current?.getCenter();
        const ref = userGps ?? (c ? { lat: c.lat, lng: c.lng } : null);
        if (!ref) return baseStations.slice(0, 8);
        return [...stations]
          .filter((st) => st.lat != null && st.lng != null)
          .sort(
            (a, b) =>
              calculateHaversineKm(ref.lat, ref.lng, a.lat, a.lng) - calculateHaversineKm(ref.lat, ref.lng, b.lat, b.lng),
          )
          .slice(0, 8);
      })()
    : [];

  const standardRows = useMemo(() => {
    const pinned = pinnedId ? filteredStations.find((st) => st.id === pinnedId) : undefined;
    const rest = nearestTop5Stations.filter((st) => st.id !== pinned?.id);
    return (pinned ? [pinned, ...rest] : rest).slice(0, 5);
  }, [filteredStations, pinnedId]);


  // One reset for everything the driver can narrow the map by (search, status, city, distance, type).
  const resetAllFilters = () => {
    setSearchQuery('');
    setPinnedId(null);
    setActiveFilter('all');
    setActiveCity('all');
    setStationTypeFilter('all');
  };

  return (
    <div className="relative w-full h-[100dvh] lg:h-[calc(100vh-4rem)] overflow-hidden bg-surface-container-low lg:flex lg:flex-row">
      {/* Leaflet Map Container (Flex-1 on Desktop) */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 lg:flex-1 lg:relative lg:h-full" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface/90 text-white text-body font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-md animate-fade-in pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Mobile top overlay: search pill + round Share button, no logo pill (redesign: "the map is the hero").
          data-theme="light" because the redesign handoff only specifies a light palette — forcing light
          here and on the desktop panel avoids a half-light/half-dark mismatch until a dark variant of the
          new design exists. */}
      <div data-theme="light" className="lg:hidden absolute top-0 inset-x-0 z-30 pointer-events-none pt-safe px-4">
        <div className="flex items-center gap-2.5 pt-3">
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search stations, city or state"
            className="pointer-events-auto flex-1 min-w-0 h-[52px] pl-4 pr-4 rounded-full bg-white flex items-center gap-2.5 text-left shadow-[0_6px_20px_rgba(20,32,26,0.12)] font-geist"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-rd-ink text-[22px] shrink-0">search</span>
            <span className={`flex-1 min-w-0 truncate text-[0.9375rem] ${searchQuery ? 'font-semibold text-rd-ink' : 'font-normal text-rd-text-tertiary'}`}>
              {searchQuery || 'Where do you want to fill up?'}
            </span>
          </button>
          {onShareApp && (
            <button
              onClick={onShareApp}
              aria-label="Share the app with other drivers"
              className="pointer-events-auto shrink-0 w-[52px] h-[52px] rounded-full bg-white flex items-center justify-center shadow-[0_6px_20px_rgba(20,32,26,0.12)] active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-rd-ink text-[20px]">share</span>
            </button>
          )}
        </div>

      </div>

      {isAreaPickerOpen && (
        <Modal isOpen onClose={() => setIsAreaPickerOpen(false)} title="Choose your area">
          <div className="flex flex-col gap-1 -mx-1">
            {(['all', ...Object.keys(CITY_LABELS)] as const).map((key) => {
              const active = activeCity === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    handleCitySelect(key);
                    setAreaBannerDismissed(true);
                    setIsAreaPickerOpen(false);
                  }}
                  className={`text-left px-3 py-2.5 rounded-xl text-body font-semibold flex items-center justify-between transition-colors ${
                    active ? 'bg-primary-container text-on-surface' : 'text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {key === 'all' ? 'Nationwide' : CITY_LABELS[key]}
                  {active && <span aria-hidden="true" className="material-symbols-outlined text-primary text-[18px]">check</span>}
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {/* Mobile bottom sheet — data-theme="light", see the top overlay's comment above. */}
      <div data-theme="light" className="lg:hidden absolute bottom-0 left-0 right-0 z-30 max-w-xl mx-auto pointer-events-none">
        <button
          onClick={handleRecenter}
          aria-label="My Location"
          title={gpsStatusText}
          className={`pointer-events-auto absolute right-4 -top-16 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-[0_6px_20px_rgba(20,32,26,0.12)] active:scale-95 transition-all ${
            sheetMode === 'expanded' ? 'opacity-0 pointer-events-none! scale-75' : ''
          } ${gpsStatus === 'active' ? 'text-primary' : gpsStatus === 'denied' ? 'text-status-red' : 'text-status-amber'}`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[24px]">
            {gpsStatus === 'active' ? 'near_me' : gpsStatus === 'denied' ? 'location_disabled' : 'location_searching'}
          </span>
        </button>

        <div
          ref={sheetRef}
          className={`w-full bg-white rounded-t-[28px] shadow-[0_-10px_30px_rgba(20,32,26,0.12),0_100vh_0_0_#FFFFFF] pointer-events-auto flex flex-col overflow-hidden will-change-transform max-h-[calc(100dvh-8rem)] ${
            sheetMode === 'expanded' ? 'h-[calc(100dvh-8rem)]' : sheetMode === 'collapsed' ? 'pb-24' : ''
          }`}
        >
          <div className="relative shrink-0">
            <button
              onPointerDown={onSheetPointerDown}
              onPointerMove={onSheetPointerMove}
              onPointerUp={onSheetPointerEnd}
              onPointerCancel={onSheetPointerEnd}
              onClick={(e) => {
                // keyboard activation only; pointer taps are handled on pointer-up
                if (e.detail === 0) toggleSheetMode();
              }}
              style={{ touchAction: 'none' }}
              aria-label="Station list size — drag or tap to change"
              className="w-full pt-3 pb-4 flex flex-col items-center"
            >
              <div className="w-10 h-1.5 bg-[#D5D8D6] rounded-full" />
            </button>
            {filteredStations.length > 0 && sheetMode !== 'collapsed' && (
              <button
                onClick={toggleSheetMode}
                className="absolute right-3 top-1 h-9 px-2 flex items-center gap-0.5 text-caption font-bold text-primary active:opacity-70"
              >
                {sheetMode === 'expanded'
                  ? 'Show less'
                  : `See all ${filteredStations.length}`}
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                  {sheetMode === 'expanded' ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
                </span>
              </button>
            )}
          </div>

          {/* Location notice lives IN the sheet: in the top overlay the sheet (same z-layer, later in the
              DOM) painted over it, so drivers never saw why the map was showing a default area. */}
          {showAreaFallback && sheetMode !== 'collapsed' && (
            <div role="status" className="mx-4 mb-2.5 shrink-0 rounded-2xl bg-rd-queuing-container text-rd-on-queuing-container px-3.5 py-3 flex items-start gap-2.5">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                {gpsStatus === 'denied' ? 'location_disabled' : 'location_searching'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-bold">
                  Showing stations near {activeCity !== 'all' ? CITY_LABELS[activeCity] : homeState || 'Abuja'}
                </p>
                <p className="text-micro mt-0.5">
                  {gpsStatus === 'denied'
                    ? 'Location is blocked for this site — enable it in your browser or device settings, then reload.'
                    : "We couldn't get your location. If this isn't where you are:"}
                </p>
                <button
                  type="button"
                  onClick={() => setIsAreaPickerOpen(true)}
                  className="mt-1.5 min-h-8 text-caption font-bold underline underline-offset-2 active:opacity-70"
                >
                  Choose a different area
                </button>
              </div>
              <button
                type="button"
                onClick={() => setAreaBannerDismissed(true)}
                aria-label="Dismiss location notice"
                className="shrink-0 w-10 h-10 -mt-1.5 -mr-1.5 flex items-center justify-center rounded-full hover:bg-black/5"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )}

          {/* Status tabs (like the ride-type tabs in ride-hailing apps) */}
          <div role="tablist" aria-label="Filter by pump status" className="flex gap-1.5 overflow-x-auto hide-scrollbar px-4 pb-2.5 shrink-0">
            {statusChips.map((chip) => {
              const active = activeFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  role="tab"
                  aria-selected={active}
                  aria-label={chip.full}
                  onClick={() => {
                    setActiveFilter(chip.key);
                    track('filter_applied', { status: chip.key });
                  }}
                  className={`shrink-0 rounded-full flex items-center gap-1.5 text-[0.8125rem] font-semibold font-geist py-[7px] px-3 transition-colors ${
                    active ? 'bg-rd-ink text-white' : 'bg-rd-chip-grey text-rd-ink'
                  }`}
                >
                  {chip.icon && (
                    <span aria-hidden="true" className={`material-symbols-outlined text-[15px] ${active ? 'text-white' : chip.iconColor}`}>
                      {chip.icon}
                    </span>
                  )}
                  {chip.label}
                </button>
              );
            })}
          </div>

          {sheetMode === 'collapsed' ? null : filteredStations.length === 0 ? (
            <div className="px-5 pt-4 pb-28 text-center flex flex-col items-center gap-2">
              <h3 className="font-extrabold text-on-surface text-body-lg">No stations found</h3>
              <p className="text-caption text-on-surface-variant max-w-xs">
                {searchQuery.trim()
                  ? `Nothing matches "${searchQuery.trim()}". Try just the station name or the city.`
                  : 'Nothing matches your filters right now.'}
              </p>
              <button
                onClick={resetAllFilters}
                className="mt-1 px-6 py-3 bg-primary text-white text-caption font-bold rounded-full active:scale-95 transition-all"
              >
                Reset filters
              </button>
            </div>
          ) : sheetMode !== 'expanded' ? (
            <div className="overflow-y-auto flex-1 hide-scrollbar px-5 pt-3 pb-28 flex flex-col gap-1">
              <h2 className="sr-only">Nearby stations</h2>
              {standardRows[0] && renderNearestCard(standardRows[0])}
              {standardRows.slice(1).map((st) => renderCompactRow(st))}
            </div>
          ) : (
            <div className="px-5 pt-1 pb-28 overflow-y-auto flex-1 hide-scrollbar flex flex-col">
              <h2 className="sr-only">All stations</h2>
              {filteredStations.slice(0, visibleCount).map((station) => renderPhoneRow(station))}
              {visibleCount < filteredStations.length && (
                <button
                  onClick={() => setVisibleCount((c) => c + 25)}
                  className="w-full mt-2 py-3 rounded-full bg-surface-container text-primary text-caption font-bold active:scale-[0.98] transition-all"
                >
                  Show more ({filteredStations.length - visibleCount} left)
                </button>
              )}
              <button
                onClick={() => setIsSuggestModalOpen(true)}
                className="w-full py-3 text-primary text-caption font-bold flex items-center justify-center gap-2"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add_location_alt</span>
                Can&apos;t find a station? Suggest one
              </button>
            </div>
          )}
        </div>
      </div>

      {isSearchOpen && (
        <StationSearchOverlay
          stations={stations}
          distanceKm={(st) => (userGps ? getDistanceKm(st) : 999)}
          suggestions={closestSuggestions}
          suggestionsTitle={userGps ? 'Closest to you' : 'Closest to this part of the map'}
          statusMeta={(st) => {
            const info = getStatusIndicator(st.status);
            return { dot: info.dotColor, label: info.shortLabel };
          }}
          initialQuery={searchQuery}
          onPick={handlePickFromSearch}
          onApply={handleApplySearch}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {/* Desktop Persistent Right-Hand Panel (lg: 1024px and above).
          Rebuilt to the same system as the phone map: rd tokens, Geist, status chips and a
          freshness-aware list so a station reported minutes ago reads differently from one
          nobody has reported in days. data-theme="light" like every other redesigned screen
          (the handoff has no dark values yet). */}
      <aside
        data-theme="light"
        aria-label="Stations"
        className="hidden lg:flex flex-col w-[380px] xl:w-[420px] bg-rd-bg text-rd-ink h-full z-20 shadow-[-8px_0_24px_rgba(20,32,26,0.08)] overflow-hidden shrink-0"
      >
        <div className="p-4 pb-3 flex flex-col gap-3 bg-white border-b border-rd-divider">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-geist font-bold text-[1.25rem] tracking-tight leading-tight">Stations</h2>
              <p className="text-caption text-rd-text-tertiary mt-0.5" aria-live="polite">
                {filteredStations.length} shown · {desktopLiveCount} reported in the last 24h
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSuggestModalOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-rd-ink text-white font-geist font-semibold text-[0.8125rem] active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rd-ink"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add_location_alt</span>
              Suggest station
            </button>
          </div>

          <div className="flex items-center bg-rd-segmented-track rounded-full px-4 h-11 gap-2 focus-within:ring-2 focus-within:ring-rd-ink">
            <span aria-hidden="true" className="material-symbols-outlined text-rd-text-tertiary text-[18px]">search</span>
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search stations, city or state"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search station, city, state…"
              className="flex-1 bg-transparent border-none outline-none text-[0.875rem] font-medium text-rd-ink placeholder:text-rd-text-tertiary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="w-6 h-6 rounded-full text-rd-text-tertiary hover:text-rd-ink flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-ink"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Only meaningful once EV stations are shown again (SHOW_EV_STATIONS in mockData.ts) */}
          {SHOW_EV_STATIONS && (
            <div role="group" aria-label="Station type" className="grid grid-cols-2 gap-1 p-1 bg-rd-segmented-track rounded-full">
              {(['all', 'cng'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={stationTypeFilter === type}
                  onClick={() => setStationTypeFilter(type)}
                  className={`h-8 rounded-full text-[0.8125rem] font-geist font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-ink ${
                    stationTypeFilter === type ? 'bg-rd-ink text-white' : 'text-rd-text-tertiary hover:text-rd-ink'
                  }`}
                >
                  {type === 'all' ? 'All' : 'CNG'}
                </button>
              ))}
            </div>
          )}

          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {statusChips.map((chip) => {
              const active = activeFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  aria-label={chip.key === 'all' ? chip.full : `${chip.full} only`}
                  onClick={() => setActiveFilter(chip.key)}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[0.8125rem] font-geist font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-rd-ink ${
                    active ? 'bg-rd-ink text-white' : 'bg-white text-rd-ink ring-1 ring-[#E3E6E4] hover:ring-rd-ink/40'
                  }`}
                >
                  {chip.icon && (
                    <span aria-hidden="true" className={`material-symbols-outlined text-[16px] ${active ? 'text-white' : chip.iconColor}`}>
                      {chip.icon}
                    </span>
                  )}
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span id="desktop-sort-label" className="font-geist-mono text-[11px] font-medium tracking-[0.08em] uppercase text-rd-text-tertiary">
              Sort
            </span>
            <div role="group" aria-labelledby="desktop-sort-label" className="flex gap-1 p-1 bg-rd-segmented-track rounded-full">
              {(
                [
                  { key: 'nearest', label: 'Nearest' },
                  { key: 'freshest', label: 'Latest report' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={effectiveDesktopSort === opt.key}
                  onClick={() => setDesktopSort(opt.key)}
                  className={`h-7 px-3 rounded-full text-[0.75rem] font-geist font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-ink ${
                    effectiveDesktopSort === opt.key ? 'bg-white text-rd-ink shadow-sm' : 'text-rd-text-tertiary hover:text-rd-ink'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {desktopStations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
            <span aria-hidden="true" className="w-14 h-14 rounded-full bg-rd-segmented-track text-rd-text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">search_off</span>
            </span>
            <p className="font-geist font-bold text-[1.0625rem]">No stations match</p>
            <p className="text-caption text-rd-text-tertiary">Try a different search or clear the filters to see every station again.</p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="h-10 px-5 rounded-full bg-rd-ink text-white font-geist font-semibold text-[0.875rem] active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rd-ink"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
            {desktopStations.map((station, index) => {
              const isSelected = selectedStation?.id === station.id;
              const tier = getFreshness(station).tier;
              const isLive = tier === 'fresh' || tier === 'recent';
              const prevIsLive = index > 0 && ['fresh', 'recent'].includes(getFreshness(desktopStations[index - 1]).tier);
              // In "latest report" order the list is split in two; label the seam.
              const sectionLabel =
                effectiveDesktopSort === 'freshest' && !searchQuery.trim()
                  ? index === 0 && isLive
                    ? 'Reported in the last 24 hours'
                    : !isLive && (index === 0 || prevIsLive)
                    ? 'Older or never reported'
                    : null
                  : null;

              return (
                <React.Fragment key={`desktop-${station.id}`}>
                  {sectionLabel && (
                    <li className="px-1 pt-1.5 font-geist-mono text-[11px] font-medium tracking-[0.08em] uppercase text-rd-text-tertiary">
                      {sectionLabel}
                    </li>
                  )}
                  <li>
                    <div
                      className={`rounded-2xl bg-white transition-shadow ${flashIds?.has(station.id) ? 'flash-ring ' : ''}${
                        isSelected
                          ? 'ring-2 ring-rd-ink shadow-[0_8px_24px_rgba(20,32,26,0.12)]'
                          : 'ring-1 ring-[#E3E6E4] shadow-[0_1px_2px_rgba(20,32,26,0.04)] hover:shadow-[0_6px_18px_rgba(20,32,26,0.10)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectStation(station)}
                        aria-current={isSelected ? 'true' : undefined}
                        className="w-full text-left p-3 pb-2 flex gap-3 rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rd-ink"
                      >
                        <span className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-rd-segmented-track">
                          <img src={station.images?.[0] || ASSETS.stationWide} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </span>
                        <span className="min-w-0 flex-1 flex flex-col">
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-geist font-bold text-[0.9375rem] leading-snug text-rd-ink line-clamp-2">{station.name}</span>
                            {userGps && station.distance && (
                              <span className="font-geist-mono text-[11px] font-medium text-rd-text-tertiary shrink-0 pt-0.5">{station.distance}</span>
                            )}
                          </span>
                          <span className="text-[0.8125rem] text-rd-text-tertiary truncate mt-0.5">{station.area || station.address}</span>
                          <span className="mt-2 flex">
                            <StationStatusChip station={station} />
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center justify-end gap-2 px-3 pb-3">
                        <button
                          type="button"
                          onClick={() => onOpenStationDetails(station)}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-[0.8125rem] font-geist font-semibold text-rd-ink hover:bg-rd-segmented-track transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rd-ink"
                        >
                          Reports &amp; chat
                          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate(station)}
                          aria-label={`Directions to ${station.name}`}
                          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-primary text-white text-[0.8125rem] font-geist font-bold active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">directions</span>
                          Go
                        </button>
                      </div>
                    </div>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Suggest Station Modal */}
      <SuggestStationModal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
        onSuggestStation={(suggestion) => {
          if (onSuggestStation) {
            onSuggestStation(suggestion);
          }
          showToast('Station suggestion submitted for verification!');
        }}
      />
    </div>
  );
};
