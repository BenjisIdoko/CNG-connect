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

  const filteredStations = baseStations.filter((st) => {
    const matchesStationType =
      stationTypeFilter === 'all' || (st.stationType || 'cng') === stationTypeFilter;
    const matchesFilter = activeFilter === 'all' || st.status === activeFilter;
    const matchesCity =
      activeCity === 'all' ||
      st.state.toLowerCase().includes(activeCity.toLowerCase()) ||
      st.city.toLowerCase().includes(activeCity.toLowerCase());
    const matchesSearch = stationMatchesQuery(st, searchQuery);
    return matchesStationType && matchesFilter && matchesCity && matchesSearch;
  });
  // While searching, best matches first (then nearest); otherwise keep the natural order.
  if (searchTokens(searchQuery).length > 0) {
    filteredStations.sort(
      (a, b) => stationSearchScore(b, searchQuery) - stationSearchScore(a, searchQuery) || getDistanceKm(a) - getDistanceKm(b),
    );
  }

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

  useEffect(() => {
    if (!mapInstanceRef.current || initialFitRef.current) return;
    if (userGps) {
      initialFitRef.current = true;
      mapInstanceRef.current.flyTo([userGps.lat, userGps.lng], 13);
      return;
    }
    const validCoords = filteredStations
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => [s.lat!, s.lng!] as [number, number]);

    if (validCoords.length > 0) {
      initialFitRef.current = true;
      mapInstanceRef.current.fitBounds(L.latLngBounds(validCoords), { padding: [50, 50], maxZoom: 13 });
    }
  }, [filteredStations, userGps]);

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
          html: `<div class="w-9 h-9 rounded-full bg-primary text-white font-extrabold text-[14px] flex items-center justify-center border-[3px] border-white shadow-[0_2px_8px_rgba(31,41,35,0.35),0_0_0_4px_rgba(49,154,63,0.3)] transition-transform hover:scale-110"><span>${childCount}</span></div>`,
          className: 'custom-cluster-icon',
          iconSize: [36, 36],
        });
      },
    });

    markersLayerRef.current = clusterGroup;
    clusterGroup.addTo(map);
    mapInstanceRef.current = map;

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

      let colorClass = '#319A3F';
      const iconSymbol = isEv ? 'bolt' : 'local_gas_station';
      if (st.status === 'queue') colorClass = '#F5A623';
      if (st.status === 'low') colorClass = '#F85B23';
      if (st.status === 'out') colorClass = '#E5484D';
      if (st.status === 'unknown') colorClass = '#8B9389';

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
              <span class="material-symbols-outlined" style="font-size:15px;color:${isApprox ? colorClass : '#fff'}">${iconSymbol}</span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });
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

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const cityKey = activeCity.toLowerCase();
    const cityInfo = CITY_COORDINATES[cityKey];

    if (cityKey !== 'all' && cityInfo) {
      mapInstanceRef.current.flyTo([cityInfo.lat, cityInfo.lng], cityInfo.zoom, { duration: 1.2 });
    } else if (cityKey === 'all') {
      if (userGps) {
        mapInstanceRef.current.flyTo([userGps.lat, userGps.lng], 13, { duration: 1.2 });
      }
    }
  }, [activeCity, userGps]);

  const handleRecenter = () => {
    setIsRecentering(true);

    if (gpsStatus === 'active' && userGps) {
      showToast(`Live GPS: ${userGps.lat.toFixed(4)}° N, ${userGps.lng.toFixed(4)}° E`);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([userGps.lat, userGps.lng], 14, { duration: 1.2 });
      }
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

  const getStatusIndicator = (status: StationStatus) => {
    switch (status) {
      case 'full':
        return {
          barColor: 'bg-status-green',
          badgeBg: 'bg-emerald-50 border-emerald-200 text-primary',
          dotColor: 'bg-status-green',
          solidBg: 'bg-status-green',
          shortLabel: 'Available',
          label: 'Full stock',
        };
      case 'queue':
        return {
          barColor: 'bg-status-amber',
          badgeBg: 'bg-amber-50 border-amber-200 text-amber-900',
          dotColor: 'bg-status-amber',
          solidBg: 'bg-status-amber',
          shortLabel: 'Queuing',
          label: 'Queuing',
        };
      case 'low':
        return {
          barColor: 'bg-status-orange',
          badgeBg: 'bg-orange-50 border-orange-200 text-orange-900',
          dotColor: 'bg-status-orange',
          solidBg: 'bg-status-orange',
          shortLabel: 'Low pressure',
          label: 'Low pressure',
        };
      case 'out':
        return {
          barColor: 'bg-status-red',
          badgeBg: 'bg-rose-50 border-rose-200 text-rose-900',
          dotColor: 'bg-status-red',
          solidBg: 'bg-status-red',
          shortLabel: 'Out of service',
          label: 'Out of gas',
        };
      case 'unknown':
      default:
        return {
          barColor: 'bg-slate-400',
          badgeBg: 'bg-slate-100 border-slate-200 text-slate-700',
          dotColor: 'bg-slate-400',
          solidBg: 'bg-surface-container-high text-outline!',
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
    const info = getStatusIndicator(station.status);
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
        className={`flex items-center gap-3.5 py-2.5 px-2 -mx-2 rounded-2xl cursor-pointer active:bg-surface-container transition-colors ${isPinned ? 'bg-primary-container/50' : ''} ${flashIds?.has(station.id) ? 'flash-ring' : ''}`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[26px] text-outline shrink-0 w-9 text-center">
          local_gas_station
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[1.0625rem] text-on-surface truncate leading-snug">{station.name}</h3>
          <p className="text-caption text-outline truncate flex items-center gap-1.5">
            <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${info.dotColor}`} />
            <span className="truncate">
              {[info.shortLabel, userGps && station.distance ? station.distance : null, station.city].filter(Boolean).join(' · ')}
            </span>
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(station);
          }}
          aria-label={`Navigate to ${station.name}`}
          className="w-10 h-10 rounded-full bg-surface-container text-on-surface flex items-center justify-center active:scale-95 shrink-0"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">navigation</span>
        </button>
      </div>
    );
  };

  const statusChips: Array<{ key: string; label: string; dot: string | null }> = [
    { key: 'all', label: 'All', dot: null },
    { key: 'full', label: 'Available', dot: 'bg-status-green' },
    { key: 'queue', label: 'Queuing', dot: 'bg-status-amber' },
    { key: 'low', label: 'Low pressure', dot: 'bg-status-orange' },
  ];
  const statusCount = (key: string) =>
    key === 'all' ? baseStations.length : baseStations.filter((st) => st.status === key).length;


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
    return (pinned ? [pinned, ...rest] : rest).slice(0, 2);
  }, [filteredStations, pinnedId]);

  const hasLiveData = filteredStations.some((s) => s.status !== 'unknown');

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

      {/* Mobile top overlay: the logo and Share the App, so the map is the hero (Bolt / inDrive style) */}
      <div className="lg:hidden absolute top-0 inset-x-0 z-30 pointer-events-none pt-safe px-4">
        <div className="flex items-center justify-between pt-3">
          <div className="pointer-events-auto h-12 pl-1.5 pr-4 rounded-full bg-white flex items-center gap-2 shadow-[0_4px_14px_rgba(31,41,35,0.22)]">
            <img src="/pwa-icon.svg" alt="" className="w-9 h-9 rounded-full" />
            <span className="font-headline font-extrabold text-[1.0625rem] text-slate-900 tracking-tight">CNG&#8209;Connect</span>
          </div>
          {onShareApp && (
            <button
              onClick={onShareApp}
              aria-label="Share the app with other drivers"
              className="pointer-events-auto h-12 pl-4 pr-5 rounded-full bg-white text-slate-900 flex items-center gap-2 font-bold text-caption shadow-[0_4px_14px_rgba(31,41,35,0.22)] active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">share</span>
              Share the App
            </button>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0 z-30 max-w-xl mx-auto pointer-events-none">
        <button
          onClick={handleRecenter}
          aria-label="My Location"
          title={gpsStatusText}
          className={`pointer-events-auto absolute right-4 -top-16 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-[0_4px_14px_rgba(31,41,35,0.22)] active:scale-95 transition-all ${
            sheetMode === 'expanded' ? 'opacity-0 pointer-events-none! scale-75' : ''
          } ${gpsStatus === 'active' ? 'text-slate-900' : gpsStatus === 'denied' ? 'text-status-red' : 'text-status-amber'}`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[24px]">
            {gpsStatus === 'active' ? 'near_me' : gpsStatus === 'denied' ? 'location_disabled' : 'location_searching'}
          </span>
        </button>

        <div
          ref={sheetRef}
          className={`w-full bg-white rounded-t-[28px] shadow-[0_-6px_24px_rgba(0,0,0,0.16),0_100vh_0_0_#FFFFFF] pointer-events-auto flex flex-col overflow-hidden will-change-transform ${
            sheetMode === 'expanded' ? 'h-[calc(100dvh-8rem)]' : sheetMode === 'collapsed' ? 'pb-24' : ''
          }`}
        >
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
            className="w-full pt-2.5 pb-2 flex flex-col items-center shrink-0"
          >
            <div className="w-10 h-1.5 bg-slate-900/20 rounded-full" />
          </button>

          {/* Status tabs (like the ride-type tabs in ride-hailing apps) */}
          <div role="tablist" aria-label="Filter by pump status" className="flex gap-1.5 overflow-x-auto hide-scrollbar px-4 pb-2 shrink-0">
            {statusChips.map((chip) => {
              const active = activeFilter === chip.key;
              const n = statusCount(chip.key);
              return (
                <button
                  key={chip.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setActiveFilter(chip.key);
                    track('filter_applied', { status: chip.key });
                  }}
                  className={`shrink-0 h-11 px-4 rounded-2xl flex items-center gap-2 text-caption font-bold transition-colors ${
                    active ? 'bg-primary-container text-on-surface' : 'text-on-surface-variant active:bg-surface-container'
                  }`}
                >
                  {chip.dot && <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full ${chip.dot}`} />}
                  {chip.label}
                  {n > 0 && <span className="font-semibold text-outline">{n}</span>}
                </button>
              );
            })}
          </div>

          <div className="px-4 shrink-0">
            <div className="flex items-center bg-surface-container rounded-2xl">
              <button
                onClick={() => setIsSearchOpen(true)}
                aria-label="Search stations, city or state"
                className="flex-1 min-w-0 flex items-center gap-3 pl-4 py-4 text-left"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-on-surface text-[24px] shrink-0">search</span>
                <span className={`flex-1 min-w-0 truncate text-[1.125rem] font-semibold ${searchQuery ? 'text-on-surface' : 'text-on-surface'}`}>
                  {searchQuery || 'Where do you want to fill up?'}
                </span>
              </button>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setPinnedId(null);
                  }}
                  className="p-2 mr-2 rounded-full text-slate-500 shrink-0"
                  aria-label="Clear search"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
            </div>
          </div>

          <button
            onClick={toggleSheetMode}
            className="w-full px-5 pt-2.5 pb-0 flex items-center justify-between shrink-0 text-left"
            aria-label={sheetMode === 'expanded' ? 'Show fewer stations' : 'Show all stations'}
          >
            <h2 className="text-micro font-bold uppercase tracking-wide text-outline flex items-center gap-2">
              {hasLiveData && <span className="w-2 h-2 rounded-full bg-live-pulse animate-pulse" />}
              {searchQuery.trim()
                ? `${filteredStations.length} ${filteredStations.length === 1 ? 'result' : 'results'}`
                : gpsStatus === 'active'
                ? 'Closest to you'
                : 'Stations'}
            </h2>
            <span className="flex items-center gap-0.5 text-caption font-bold text-primary">
              {sheetMode === 'expanded' ? 'Show less' : `See all ${filteredStations.length}`}
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                {sheetMode === 'expanded' ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
              </span>
            </span>
          </button>

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
            <div className="px-5 pt-0 pb-24 flex flex-col">{standardRows.map((st) => renderPhoneRow(st))}</div>
          ) : (
            <div className="px-5 pt-1 pb-28 overflow-y-auto flex-1 hide-scrollbar flex flex-col">
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

      {/* Desktop Persistent Right-Hand Panel (lg: 1024px and above) */}
      <div className="hidden lg:flex flex-col w-[380px] xl:w-[420px] bg-surface h-full z-20 shadow-[-8px_0_24px_rgba(31,41,35,0.08)] overflow-hidden shrink-0">
        {/* Right Panel Header: Search & Filter */}
        <div className="p-4 flex flex-col gap-3 bg-white shadow-[0_2px_10px_rgba(31,41,35,0.05)]">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-[1rem] text-slate-900 flex items-center gap-2">
              <span>Stations & Chargers</span>
            </h2>
            <span className="text-[0.75rem] font-bold text-primary bg-primary-container px-3 py-1 rounded-full">
              {filteredStations.length} Results
            </span>
          </div>

          {/* Desktop Search Input */}
          <div className="flex items-center bg-surface rounded-full px-4 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-primary/20">
            <span aria-hidden="true" className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search stations, city or state"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search station, city, state..."
              className="flex-1 bg-transparent border-none outline-none text-[0.875rem] font-medium text-slate-900 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Type Filter Segment Bar — EV temporarily hidden app-wide (SHOW_EV_STATIONS in mockData.ts) */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-surface-container rounded-full">
            <button
              onClick={() => setStationTypeFilter('all')}
              className={`py-2 rounded-full text-micro font-extrabold transition-all ${
                stationTypeFilter === 'all' ? 'bg-deep-teal text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStationTypeFilter('cng')}
              className={`py-2 rounded-full text-micro font-extrabold transition-all flex items-center justify-center gap-1 ${
                stationTypeFilter === 'cng' ? 'bg-deep-teal text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">local_gas_station</span>
              <span>CNG</span>
            </button>
          </div>

          <button
            onClick={() => setIsSuggestModalOpen(true)}
            className="w-full py-2.5 bg-primary hover:bg-emerald-700 text-white rounded-full text-micro font-extrabold active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add_location_alt</span>
            <span>+ Suggest New Station</span>
          </button>
        </div>

        {/* Desktop Station List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredStations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium text-[0.875rem]">
              No stations match your criteria.
            </div>
          ) : (
            filteredStations.map((station) => {
              const statusInfo = getStatusIndicator(station.status);
              const isSelected = selectedStation?.id === station.id;

              return (
                <div
                  key={`desktop-${station.id}`}
                  onClick={() => onSelectStation(station)}
                  className={`p-4 rounded-2xl transition-all cursor-pointer ${flashIds?.has(station.id) ? 'flash-ring ' : ''}${
                    isSelected
                      ? 'bg-white ring-2 ring-primary shadow-[0_6px_18px_rgba(49,154,63,0.18)]'
                      : 'bg-white shadow-[0_4px_14px_rgba(31,41,35,0.05)] hover:shadow-[0_6px_18px_rgba(31,41,35,0.1)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusInfo.dotColor}`} />
                      <h3 className="font-extrabold text-body-lg text-slate-900 truncate">
                        {station.name}
                      </h3>
                    </div>
                    <span className="text-micro font-extrabold text-primary shrink-0">
                      {station.distance}
                    </span>
                  </div>

                  <p className="text-[0.8125rem] font-normal text-slate-500 truncate mt-1">
                    {station.address}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <span className={`text-[0.75rem] font-bold px-2 py-1 rounded-full ${statusInfo.badgeBg}`}>
                      {station.statusLabel}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStationDetails(station);
                      }}
                      className="text-micro font-extrabold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Group Chat & Specs</span>
                      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
