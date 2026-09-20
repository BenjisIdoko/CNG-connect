import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { GasStation, StationStatus, StationSuggestion } from '../types';
import { ASSETS } from '../data/mockData';
import { Modal } from './common/Modal';
import { SuggestStationModal } from './SuggestStationModal';
import { formatStationAge } from '../utils/timeUtils';
import { openWhatsAppShare } from '../utils/shareMessageBuilder';
import { getPinConfidence, getAccuracyRadiusM } from '../utils/locationPrecision';
import { isSameState } from '../utils/proximityAlertEngine';

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
  onOpenAiAssistant?: () => void;
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
  onOpenAiAssistant,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [stationTypeFilter, setStationTypeFilter] = useState<'all' | 'cng' | 'ev_charging'>('all');
  const [activeCity, setActiveCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [showPiCngInfo, setShowPiCngInfo] = useState(false);
  const [minPressure, setMinPressure] = useState<number>(0);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(0); // 0 = any distance
  const [sheetMode, setSheetMode] = useState<'standard' | 'expanded' | 'collapsed'>('standard');
  const toggleSheetMode = () => setSheetMode((prev) => (prev === 'expanded' ? 'standard' : 'expanded'));
  const [isRecentering, setIsRecentering] = useState(false);
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
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (st.operator && st.operator.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (st.network && st.network.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPressure = minPressure === 0 || (st.pumpPressure != null && st.pumpPressure >= minPressure);
    const matchesDistance = maxDistanceKm === 0 || getDistanceKm(st) <= maxDistanceKm;
    return matchesStationType && matchesFilter && matchesCity && matchesSearch && matchesPressure && matchesDistance;
  });

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
            <div class="rounded-full flex items-center justify-center transition-transform ${isSelected ? 'scale-125' : ''}" style="width:30px;height:30px;background:${isApprox ? '#ffffff' : colorClass};border:${isApprox ? '2.5px dashed ' + colorClass : '3px solid #ffffff'};box-shadow:0 2px 8px rgba(31,41,35,0.35), 0 0 0 4px ${colorClass}${isApprox ? '00' : '44'}${isSelected ? ', 0 0 0 7px rgba(31,41,35,0.85)' : ''};">
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
        onSelectStation(st);
        setSheetMode('standard');
      });

      markersLayerRef.current?.addLayer(marker);
    });

    if (userGps) {
      const gpsMarker = L.circleMarker([userGps.lat, userGps.lng], {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
      });
      markersLayerRef.current?.addLayer(gpsMarker);
    }
  }, [filteredStations, selectedStation, userGps]);

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedStation) return;
    if (userSelectedRef.current && selectedStation.lat && selectedStation.lng) {
      mapInstanceRef.current.panTo([selectedStation.lat, selectedStation.lng], { animate: true });
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
          solidBg: 'bg-slate-400',
          shortLabel: 'No recent report',
          label: 'No recent reports',
        };
    }
  };

  // True only when at least one visible station carries a real driver report
  // (anything other than 'unknown'). Drives whether the "live" pulse shows.
  const hasLiveData = filteredStations.some((s) => s.status !== 'unknown');

  const activeFilterCount =
    (activeFilter !== 'all' ? 1 : 0) +
    (activeCity !== 'all' ? 1 : 0) +
    (searchQuery.trim() !== '' ? 1 : 0) +
    (minPressure > 0 ? 1 : 0) +
    (maxDistanceKm > 0 ? 1 : 0) +
    (stationTypeFilter !== 'all' ? 1 : 0);

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

      {/* Mobile top overlay: wordmark, search, filter chips */}
      <div className="lg:hidden absolute top-0 inset-x-0 z-30 pointer-events-none pt-safe px-5">
        <div className="flex items-center justify-between pt-2 pointer-events-auto">
          <span className="font-extrabold text-slate-900 text-[1.1875rem] tracking-tight [text-shadow:0_1px_6px_rgba(255,255,255,0.9)]">CNG&#8209;Connect</span>
          {onOpenAiAssistant && (
            <button
              onClick={onOpenAiAssistant}
              aria-label="Open AI Assistant"
              className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_4px_12px_rgba(49,154,63,0.5)] active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center bg-white rounded-full shadow-[0_8px_20px_rgba(31,41,35,0.18)] px-4 gap-2 pointer-events-auto focus-within:ring-2 focus-within:ring-primary/40">
          <span className="material-symbols-outlined text-slate-400 text-[20px] shrink-0">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stations, city, state"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-caption font-medium text-slate-900 placeholder:text-slate-400 py-3.5"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-full text-slate-400 hover:bg-slate-100 shrink-0"
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto hide-scrollbar pointer-events-auto pb-1">
          {[
            { label: 'Status', active: activeFilter !== 'all', icon: 'radio_button_checked' },
            { label: 'Pressure', active: minPressure > 0, icon: null },
            { label: 'Distance', active: maxDistanceKm > 0, icon: null },
          ].map((chip) => (
            <button
              key={chip.label}
              onClick={() => setIsFilterModalOpen(true)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-micro font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-transform ${
                chip.active ? 'bg-primary text-white' : 'bg-white text-slate-900'
              }`}
            >
              {chip.icon && <span className="material-symbols-outlined text-[14px]">{chip.icon}</span>}
              {chip.label}
            </button>
          ))}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('all');
                setActiveCity('all');
                setMinPressure(0);
                setMaxDistanceKm(0);
                setStationTypeFilter('all');
              }}
              className="shrink-0 rounded-full px-3 py-1.5 text-micro font-bold text-slate-700 underline underline-offset-2"
            >
              Reset
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
          className={`pointer-events-auto absolute right-4 -top-14 w-11 h-11 rounded-full text-white flex items-center justify-center active:scale-95 transition-all ${
            gpsStatus === 'active'
              ? 'bg-primary shadow-[0_6px_16px_rgba(49,154,63,0.5)]'
              : gpsStatus === 'denied'
              ? 'bg-status-red shadow-[0_6px_16px_rgba(229,72,77,0.4)]'
              : 'bg-status-amber shadow-[0_6px_16px_rgba(245,166,35,0.4)]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {gpsStatus === 'active' ? 'my_location' : gpsStatus === 'denied' ? 'location_disabled' : 'location_searching'}
          </span>
        </button>

        <div
          className={`w-full bg-surface-container rounded-t-[24px] shadow-[0_-8px_24px_rgba(0,0,0,0.25)] pointer-events-auto transition-all duration-300 flex flex-col overflow-hidden ${
            sheetMode === 'expanded' ? 'h-[calc(100dvh-8rem)]' : ''
          }`}
        >
          <button
            onClick={toggleSheetMode}
            aria-label="Toggle station list size"
            className="w-full pt-2.5 pb-1 px-5 flex flex-col items-center shrink-0"
          >
            <div className="w-10 h-1.5 bg-slate-900/15 rounded-full mb-2.5" />
            <div className="w-full flex items-center justify-between">
              <h3 className="font-extrabold text-body-lg tracking-tight text-on-surface flex items-center gap-2">
                {hasLiveData && <span className="w-2 h-2 rounded-full bg-live-pulse animate-pulse" />}
                {filteredStations.length}{' '}
                {filteredStations.length === 1 ? 'station' : 'stations'} near you
              </h3>
              <span className="material-symbols-outlined text-slate-400 text-[20px]">
                {sheetMode === 'expanded' ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
              </span>
            </div>
          </button>

          {filteredStations.length === 0 ? (
            <div className="px-5 pt-4 pb-28 text-center flex flex-col items-center gap-2">
              <h4 className="font-extrabold text-on-surface text-body-lg">No stations found</h4>
              <p className="text-caption text-on-surface-variant max-w-xs">
                Nothing matches your search or filters right now.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                  setActiveCity('all');
                  setMinPressure(0);
                  setMaxDistanceKm(0);
                  setStationTypeFilter('all');
                }}
                className="mt-1 px-6 py-3 bg-primary text-white text-caption font-bold rounded-full active:scale-95 transition-all"
              >
                Reset filters
              </button>
            </div>
          ) : sheetMode !== 'expanded' ? (
            <div className="flex gap-3 overflow-x-auto hide-scrollbar px-5 pt-2 pb-28">
              {nearestTop5Stations.map((st) => {
                const info = getStatusIndicator(st.status);
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      onSelectStation(st);
                      onOpenStationDetails(st);
                    }}
                    className="w-40 shrink-0 bg-white rounded-2xl overflow-hidden text-left shadow-[0_4px_14px_rgba(14,20,32,0.07)] active:scale-[0.98] transition-transform"
                  >
                    <div className="h-20 bg-surface-container-high">
                      <img src={st.images?.[0] || ASSETS.stationWide} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2.5">
                      <div className="font-bold text-caption text-on-surface truncate">{st.name}</div>
                      <div className="text-micro text-outline mt-0.5 truncate">
                        {st.distance || '—'}
                        {st.pumpPressure ? ` · ${st.pumpPressure} bar` : ''}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 mt-2 rounded-md px-1.5 py-0.5 text-micro font-bold text-white ${info.solidBg}`}
                      >
                        {info.shortLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-5 pt-2 pb-28 overflow-y-auto flex-1 hide-scrollbar flex flex-col gap-2">
              {filteredStations.slice(0, visibleCount).map((station) => {
                const info = getStatusIndicator(station.status);
                const isUnknown = station.status === 'unknown';
                const age = formatStationAge(station).replace(/^Updated /, '');
                const meta = [
                  station.distance || null,
                  !isUnknown && station.pumpPressure ? `${station.pumpPressure} bar` : null,
                  !isUnknown && age !== 'No recent report' ? age : null,
                ].filter(Boolean);
                return (
                  <div
                    key={station.id}
                    onClick={() => {
                      onSelectStation(station);
                      onOpenStationDetails(station);
                    }}
                    className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-[0_4px_14px_rgba(14,20,32,0.05)] cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container-high shrink-0">
                      <img src={station.images?.[0] || ASSETS.stationWide} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-body text-on-surface truncate leading-snug">{station.name}</h4>
                      <p className="text-caption text-outline truncate">{meta.join(' · ') || 'No recent reports'}</p>
                      <span
                        className={`inline-flex items-center mt-1 rounded-md px-1.5 py-0.5 text-micro font-bold text-white ${info.solidBg}`}
                      >
                        {info.shortLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsAppShare(station);
                        }}
                        aria-label={`Share ${station.name} on WhatsApp`}
                        className="w-9 h-9 rounded-full bg-emerald-50 text-whatsapp flex items-center justify-center active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[16px]">share</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate(station);
                        }}
                        aria-label={`Navigate to ${station.name}`}
                        className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[16px]">navigation</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              {visibleCount < filteredStations.length && (
                <button
                  onClick={() => setVisibleCount((c) => c + 25)}
                  className="w-full py-3 rounded-full bg-white text-primary text-caption font-bold active:scale-[0.98] transition-all"
                >
                  Show more ({filteredStations.length - visibleCount} left)
                </button>
              )}
              <button
                onClick={() => setIsSuggestModalOpen(true)}
                className="w-full py-3 text-primary text-caption font-bold flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
                Can&apos;t find a station? Suggest one
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Persistent Right-Hand Panel (lg: 1024px and above) */}
      <div className="hidden lg:flex flex-col w-[380px] xl:w-[420px] bg-surface h-full z-20 shadow-[-8px_0_24px_rgba(31,41,35,0.08)] overflow-hidden shrink-0">
        {/* Right Panel Header: Search & Filter */}
        <div className="p-4 flex flex-col gap-3 bg-white shadow-[0_2px_10px_rgba(31,41,35,0.05)]">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-[1rem] text-slate-900 flex items-center gap-2">
              <span>Stations & Chargers</span>
            </h3>
            <span className="text-[0.75rem] font-bold text-primary bg-primary-container px-3 py-1 rounded-full">
              {filteredStations.length} Results
            </span>
          </div>

          {/* Desktop Search Input */}
          <div className="flex items-center bg-surface rounded-full px-4 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-primary/20">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search station, city, state..."
              className="flex-1 bg-transparent border-none outline-none text-[0.875rem] font-medium text-slate-900 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[16px]">close</span>
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
              <span className="material-symbols-outlined text-[14px]">local_gas_station</span>
              <span>CNG</span>
            </button>
          </div>

          <button
            onClick={() => setIsSuggestModalOpen(true)}
            className="w-full py-2.5 bg-primary hover:bg-emerald-700 text-white rounded-full text-micro font-extrabold active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
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
                  className={`p-4 rounded-2xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white ring-2 ring-primary shadow-[0_6px_18px_rgba(49,154,63,0.18)]'
                      : 'bg-white shadow-[0_4px_14px_rgba(31,41,35,0.05)] hover:shadow-[0_6px_18px_rgba(31,41,35,0.1)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusInfo.dotColor}`} />
                      <h4 className="font-extrabold text-body-lg text-slate-900 truncate">
                        {station.name}
                      </h4>
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
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Filter Modal */}
      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Filters">
        <div className="flex flex-col gap-6 py-1 text-on-surface">
          {/* Distance */}
          <div>
            <label className="block text-micro font-bold text-outline uppercase tracking-wider mb-2.5">Distance</label>
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 10, 25, 50].map((dist) => (
                <button
                  key={dist}
                  type="button"
                  onClick={() => setMaxDistanceKm(dist)}
                  className={`px-4 py-2 rounded-full text-caption font-semibold transition-all active:scale-95 ${
                    maxDistanceKm === dist ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500'
                  }`}
                >
                  {dist === 0 ? 'Any' : `${dist} km`}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-micro font-bold text-outline uppercase tracking-wider mb-2.5">Status</label>
            <div className="flex flex-col gap-2">
              {[
                { key: 'all', label: 'All statuses', dot: 'bg-slate-400' },
                { key: 'full', label: 'Available', dot: 'bg-status-green' },
                { key: 'queue', label: 'Queuing', dot: 'bg-status-amber' },
                { key: 'low', label: 'Low pressure', dot: 'bg-status-orange' },
                { key: 'out', label: 'Out of service', dot: 'bg-status-red' },
              ].map((opt) => {
                const on = activeFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setActiveFilter(opt.key)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all active:scale-[0.99] ${
                      on ? 'bg-primary-container ring-[1.5px] ring-primary' : 'bg-surface-container'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                    <span className="flex-1 text-caption font-semibold">{opt.label}</span>
                    {on && <span className="material-symbols-outlined text-primary text-[18px]">check</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Pressure */}
          <div>
            <div className="flex justify-between text-micro font-bold uppercase tracking-wider mb-3">
              <span className="text-outline">Minimum pump pressure</span>
              <span className="text-primary">{minPressure === 0 ? 'Any' : `${minPressure}+ bar`}</span>
            </div>
            <input
              type="range"
              min="0"
              max="220"
              step="20"
              value={minPressure}
              onChange={(e) => setMinPressure(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="w-full py-3.5 bg-primary text-white font-bold text-body rounded-full shadow-[0_8px_18px_rgba(49,154,63,0.3)] active:scale-[0.98] transition-all"
            >
              Show {filteredStations.length} {filteredStations.length === 1 ? 'station' : 'stations'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMinPressure(0);
                setMaxDistanceKm(0);
                setActiveFilter('all');
                setStationTypeFilter('all');
              }}
              className="w-full py-2 text-primary font-semibold text-caption"
            >
              Reset filters
            </button>
          </div>
        </div>
      </Modal>

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
