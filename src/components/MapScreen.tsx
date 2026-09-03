import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { GasStation, StationStatus, StationSuggestion } from '../types';

// Configure Leaflet default marker assets for Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
import { ASSETS } from '../data/mockData';
import { Modal } from './common/Modal';
import { SuggestStationModal } from './SuggestStationModal';
import { formatStationAge } from '../utils/timeUtils';
import { openWhatsAppShare } from '../utils/shareMessageBuilder';

export type GpsStatus = 'active' | 'denied' | 'unavailable';

interface MapScreenProps {
  stations: GasStation[];
  selectedStation: GasStation;
  onSelectStation: (station: GasStation) => void;
  onOpenStationDetails: (station: GasStation) => void;
  onNavigate: (station: GasStation) => void;
  gpsStatus?: GpsStatus;
  userGps?: { lat: number; lng: number } | null;
  onGpsStatusChange?: (status: GpsStatus, coords?: { lat: number; lng: number }) => void;
  onSuggestStation?: (suggestion: Omit<StationSuggestion, 'id' | 'createdAt' | 'status'>) => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  stations,
  selectedStation,
  onSelectStation,
  onOpenStationDetails,
  onNavigate,
  gpsStatus: propGpsStatus,
  userGps: propUserGps,
  onGpsStatusChange,
  onSuggestStation,
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

  const filteredStations = stations.filter((st) => {
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

    // Standard OpenStreetMap public tile server (100% free, no API key required)
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
          html: `<div class="w-9 h-9 rounded-full bg-primary text-white font-extrabold text-[12px] flex items-center justify-center border-2 border-white shadow-md transition-transform hover:scale-110"><span>${childCount}</span></div>`,
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

      let colorClass = '#00c853';
      let iconSymbol = 'local_gas_station';

      if (isEv) {
        // Visually distinct Cyan/Sky Blue color family for EV stations
        colorClass = '#0284c7'; // Available Sky Blue
        if (st.status === 'queue') colorClass = '#0891b2'; // Busy Cyan
        if (st.status === 'low') colorClass = '#0369a1'; // Full Dark Cyan
        if (st.status === 'out') colorClass = '#475569'; // Out of Service Slate
        if (st.status === 'unknown') colorClass = '#64748b';
        iconSymbol = 'bolt';
      } else {
        if (st.status === 'queue') colorClass = '#FF6D00';
        if (st.status === 'low') colorClass = '#FF6D00';
        if (st.status === 'out') colorClass = '#FF3D00';
        if (st.status === 'unknown') colorClass = '#94a3b8';
      }

      const displayText = isEv
        ? (st.chargingSpeedKw ? `${st.chargingSpeedKw}kW` : 'EV')
        : (st.pumpPressure ? `${st.pumpPressure} bar` : (st.status === 'unknown' ? 'No reports' : 'CNG'));

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="relative group cursor-pointer flex flex-col items-center">
            <div class="px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-md flex items-center gap-1 transition-transform transform ${isSelected ? 'scale-125 ring-2 ring-white' : ''}" style="background-color: ${colorClass};">
              <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span class="material-symbols-outlined text-[12px]">${iconSymbol}</span>
              <span>${displayText}</span>
            </div>
            <div class="w-2.5 h-2.5 rotate-45 border-r border-b border-white -mt-1 shadow-xs" style="background-color: ${colorClass};"></div>
          </div>
        `,
        iconSize: [70, 30],
        iconAnchor: [35, 30],
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
          label: 'Full stock',
        };
      case 'queue':
        return {
          barColor: 'bg-status-orange',
          badgeBg: 'bg-amber-50 border-amber-200 text-amber-900',
          dotColor: 'bg-status-orange',
          label: 'Queuing',
        };
      case 'low':
        return {
          barColor: 'bg-status-orange',
          badgeBg: 'bg-orange-50 border-orange-200 text-orange-900',
          dotColor: 'bg-status-orange',
          label: 'Low pressure',
        };
      case 'out':
        return {
          barColor: 'bg-status-red',
          badgeBg: 'bg-rose-50 border-rose-200 text-rose-900',
          dotColor: 'bg-status-red',
          label: 'Out of gas',
        };
      case 'unknown':
      default:
        return {
          barColor: 'bg-slate-400',
          badgeBg: 'bg-slate-100 border-slate-200 text-slate-700',
          dotColor: 'bg-slate-400',
          label: 'No recent reports',
        };
    }
  };

  const activeFilterCount =
    (activeFilter !== 'all' ? 1 : 0) +
    (activeCity !== 'all' ? 1 : 0) +
    (searchQuery.trim() !== '' ? 1 : 0) +
    (minPressure > 0 ? 1 : 0);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-surface-container-low lg:flex lg:flex-row">
      {/* Leaflet Map Container (Flex-1 on Desktop) */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 lg:flex-1 lg:relative lg:h-full" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface/90 text-white text-body font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-md animate-fade-in pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Mobile-Only Floating Search Bar Container (< lg:) */}
      <div className="lg:hidden relative z-30 p-4 max-w-xl mx-auto flex flex-col gap-2 pointer-events-auto">
        {/* Floating Search Pill Bar */}
        <div className="flex items-center bg-white/95 backdrop-blur-xl rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.08)] border border-slate-200/80 p-2 pl-4 gap-2 transition-all focus-within:ring-2 focus-within:ring-emerald-500/30">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by station, city, state, or operator..."
            className="flex-1 bg-transparent border-none outline-none text-body font-medium text-slate-900 placeholder:text-slate-400"
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

          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            <button
              onClick={() => setIsFilterModalOpen(true)}
              aria-label="Filter stations"
              className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 active:scale-95 transition-all flex items-center justify-center relative"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-status-green text-deep-teal text-micro font-black rounded-full flex items-center justify-center border border-white shadow-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={handleRecenter}
              aria-label="My Location"
              title={gpsStatusText}
              className={`w-9 h-9 text-white rounded-full active:scale-95 transition-all flex items-center justify-center shadow-md ${
                gpsStatus === 'active'
                  ? 'bg-live-pulse hover:bg-emerald-600 shadow-emerald-500/25'
                  : gpsStatus === 'denied'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {gpsStatus === 'active' ? 'near_me' : gpsStatus === 'denied' ? 'location_off' : 'wrong_location'}
              </span>
            </button>
          </div>
        </div>

        {/* Station Type Filter Pills & Suggest Station Action Button */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-0.5">
          <button
            onClick={() => setStationTypeFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-micro font-extrabold transition-all shadow-xs flex items-center gap-1 shrink-0 ${
              stationTypeFilter === 'all'
                ? 'bg-slate-900 text-white ring-2 ring-slate-900/20'
                : 'bg-white/95 backdrop-blur-md text-slate-700 hover:bg-white border border-slate-200'
            }`}
          >
            <span>All Stations</span>
          </button>

          <button
            onClick={() => setStationTypeFilter('cng')}
            className={`px-3.5 py-1.5 rounded-full text-micro font-extrabold transition-all shadow-xs flex items-center gap-1 shrink-0 ${
              stationTypeFilter === 'cng'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/30'
                : 'bg-white/95 backdrop-blur-md text-emerald-800 hover:bg-white border border-emerald-200'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">local_gas_station</span>
            <span>CNG Refuelling</span>
          </button>

          <button
            onClick={() => setStationTypeFilter('ev_charging')}
            className={`px-3.5 py-1.5 rounded-full text-micro font-extrabold transition-all shadow-xs flex items-center gap-1 shrink-0 ${
              stationTypeFilter === 'ev_charging'
                ? 'bg-sky-600 text-white ring-2 ring-sky-600/30'
                : 'bg-white/95 backdrop-blur-md text-sky-900 hover:bg-white border border-sky-200'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">bolt</span>
            <span>⚡ EV Charging</span>
          </button>

          <button
            onClick={() => setIsSuggestModalOpen(true)}
            className="ml-auto px-3.5 py-1.5 rounded-full bg-primary/95 hover:bg-primary text-white text-micro font-extrabold shadow-md flex items-center gap-1 shrink-0 active:scale-95 transition-all"
            title="Suggest a new CNG or EV station"
          >
            <span className="material-symbols-outlined text-[14px]">add_location_alt</span>
            <span>+ Suggest Station</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Sheet (< lg:) */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0 z-30 max-w-xl mx-auto pointer-events-none">
        <div
          className={`w-full bg-white rounded-t-[32px] shadow-[0_-8px_32px_rgba(0,0,0,0.14)] border-t border-outline-variant pointer-events-auto transition-all duration-300 flex flex-col overflow-hidden ${
            sheetMode === 'expanded'
              ? 'h-[calc(100vh-8rem)]'
              : sheetMode === 'collapsed'
              ? 'h-[68px]'
              : 'max-h-[58vh]'
          }`}
        >
          {/* Drawer Drag Bar & Header */}
          <div
            onClick={toggleSheetMode}
            className="w-full pt-3 pb-2 px-4 flex flex-col items-center cursor-pointer select-none bg-white shrink-0 border-b border-outline-variant/30"
          >
            <div className="w-10 h-1.25 bg-outline-variant rounded-full mb-2" />
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-status-green animate-pulse" />
                <h3 className="font-extrabold text-body-lg text-on-surface">
                  {filteredStations.length} CNG Stations Near You
                </h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSheetMode();
                }}
                className="text-outline hover:text-on-surface text-caption font-bold flex items-center gap-0.5"
              >
                <span>{sheetMode === 'expanded' ? 'Collapse' : sheetMode === 'standard' ? 'Expand' : 'Show list'}</span>
                <span className="material-symbols-outlined text-[16px]">
                  {sheetMode === 'expanded' ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
                </span>
              </button>
            </div>
          </div>

          {/* Drawer Scrollable Content */}
          {sheetMode !== 'collapsed' && (
            <div className="px-4 pb-20 pt-3 overflow-y-auto flex-1 hide-scrollbar flex flex-col gap-4">
              {filteredStations.length === 0 ? (
                <div className="bg-white rounded-3xl p-6 text-center border border-outline-variant shadow-xs flex flex-col items-center gap-2 my-2">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container text-primary flex items-center justify-center font-black">
                    <span className="material-symbols-outlined text-[28px]">filter_alt_off</span>
                  </div>
                  <h4 className="font-extrabold text-on-surface text-body-lg">No CNG Stations Found</h4>
                  <p className="text-caption text-on-surface-variant font-medium max-w-xs">
                    No stations match your current search term or filter criteria.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setActiveFilter('all');
                      setActiveCity('all');
                      setMinPressure(0);
                      setMaxDistanceKm(0);
                    }}
                    className="mt-1 px-5 py-2.5 bg-primary hover:opacity-95 text-on-primary text-caption font-extrabold rounded-full shadow-md active:scale-95 transition-all"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <>
                  {/* Vertical Ranked List (Primary Decision-Useful View) */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5 px-1">
                      <div>
                        <h3 className="font-black text-body-lg text-on-surface leading-tight">
                          Nearest Stations
                        </h3>
                        <span className="text-micro font-bold text-outline">
                          Sorted by GPS distance ({sheetMode === 'expanded' ? filteredStations.length : nearestTop5Stations.length} shown)
                        </span>
                      </div>
                      {sheetMode === 'standard' && (
                        <button
                          onClick={() => setSheetMode('expanded')}
                          className="text-caption font-extrabold text-primary hover:underline"
                        >
                          See all ({filteredStations.length})
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {(sheetMode === 'expanded' ? filteredStations.slice(0, visibleCount) : nearestTop5Stations).map((station) => {
                        const statusInfo = getStatusIndicator(station.status);
                        const isSelected = selectedStation?.id === station.id;

                        return (
                          <div
                            key={station.id}
                            onClick={() => {
                              onSelectStation(station);
                            }}
                            className={`bg-white border rounded-2xl p-3 shadow-2xs flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] ${
                              isSelected
                                ? 'border-primary ring-2 ring-primary/15 bg-surface-container/50'
                                : 'border-outline-variant/80 hover:border-outline-variant'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusInfo.dotColor}`} />

                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-body-lg text-on-surface truncate leading-snug">
                                  {station.name}
                                </h4>
                                <div className="flex flex-wrap items-center gap-1.5 text-caption text-on-surface-variant mt-0.5">
                                  <span className="font-bold text-primary">{station.distance}</span>
                                  <span>•</span>
                                  <span className="font-medium">{station.statusLabel}</span>
                                  {Boolean(station.pumpPressure && station.pumpPressure > 0) && (
                                    <>
                                      <span>•</span>
                                      <span className="font-semibold text-on-surface-variant">{station.pumpPressure} bar</span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span className={`font-bold ${station.status === 'unknown' ? 'text-slate-400' : 'text-primary'}`}>
                                    {formatStationAge(station)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openWhatsAppShare(station);
                                }}
                                aria-label={`Share ${station.name} on WhatsApp`}
                                title="Share update on WhatsApp"
                                className="w-8 h-8 rounded-full bg-emerald-50 text-whatsapp hover:bg-emerald-100 flex items-center justify-center active:scale-95 transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  share
                                </span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(station);
                                }}
                                aria-label={`Navigate to ${station.name}`}
                                className="w-8 h-8 rounded-full bg-surface-container text-primary hover:bg-surface-container-high flex items-center justify-center active:scale-95 transition-all"
                              >
                                <span className="material-symbols-outlined text-[17px]">
                                  navigation
                                </span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenStationDetails(station);
                                }}
                                aria-label={`View details of ${station.name}`}
                                className="w-7 h-7 rounded-full text-outline hover:text-on-surface flex items-center justify-center"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  chevron_right
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {sheetMode === 'expanded' && filteredStations.length > visibleCount && (
                      <button
                        onClick={() => setVisibleCount((prev) => prev + 25)}
                        className="w-full py-2.5 my-2 bg-emerald-50 hover:bg-emerald-100 text-primary border border-emerald-200 text-body font-extrabold rounded-full transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[18px]">expand_more</span>
                        <span>Load More Stations (Showing {visibleCount} of {filteredStations.length})</span>
                      </button>
                    )}
                  </div>

                  {/* Secondary Horizontal Carousel (Shown ONLY in Expanded Mode below the vertical list) */}
                  {sheetMode === 'expanded' && (
                    <div className="pt-2 border-t border-outline-variant/40">
                      <div className="flex items-center justify-between mb-2.5 px-1">
                        <h3 className="font-bold text-body-lg text-on-surface">
                          Browse Station Photos
                        </h3>
                        <span className="text-micro font-semibold text-outline">
                          Swipe to view
                        </span>
                      </div>

                      <div className="flex overflow-x-auto gap-3.5 pb-2 px-1 hide-scrollbar">
                        {nearestTop5Stations.map((st) => (
                          <div
                            key={`carousel-${st.id}`}
                            onClick={() => {
                              onSelectStation(st);
                              onOpenStationDetails(st);
                            }}
                            className="w-56 shrink-0 bg-white rounded-2xl border border-outline-variant/80 p-2.5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between active:scale-98"
                          >
                            <div>
                              <div className="w-full h-24 rounded-xl overflow-hidden relative mb-2 bg-surface-container">
                                <img
                                  src={st.images?.[0] || ASSETS.stationWide}
                                  alt={st.name}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute top-2 left-2 bg-primary/90 backdrop-blur-md text-status-green text-micro font-semibold px-2 py-0.5 rounded-xl border border-status-green/30">
                                  {st.statusLabel}
                                </span>
                              </div>

                              <h4 className="font-bold text-body text-on-surface truncate leading-snug">
                                {st.name}
                              </h4>
                              <p className="text-micro font-normal text-on-surface-variant truncate mt-0.5">
                                {st.address}
                              </p>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-outline-variant/30 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-micro font-medium text-on-surface-variant">
                                <span className="font-semibold text-primary">{formatStationAge(st)}</span>
                                <span>•</span>
                                <span>{st.distance}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWhatsAppShare(st);
                                  }}
                                  aria-label={`Share ${st.name} on WhatsApp`}
                                  title="Share to WhatsApp"
                                  className="w-6 h-6 rounded-full bg-emerald-50 text-whatsapp hover:bg-emerald-100 flex items-center justify-center active:scale-95 transition-all"
                                >
                                  <span className="material-symbols-outlined text-[13px]">share</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate(st);
                                  }}
                                  className="px-2.5 py-1 bg-status-green text-on-surface rounded-full text-micro font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[13px]">navigation</span>
                                  <span>Nav</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Persistent Right-Hand Panel (lg: 1024px and above) */}
      <div className="hidden lg:flex flex-col w-[380px] xl:w-[420px] bg-white border-l border-slate-200 h-full z-20 shadow-lg overflow-hidden shrink-0">
        {/* Right Panel Header: Search & Filter */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col gap-3 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-[16px] text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">explore</span>
              <span>Stations & Chargers</span>
            </h3>
            <span className="text-[11px] font-bold text-primary bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {filteredStations.length} Results
            </span>
          </div>

          {/* Desktop Search Input */}
          <div className="flex items-center bg-white rounded-xl border border-slate-300 px-3 py-2 gap-2 shadow-2xs focus-within:ring-2 focus-within:ring-primary/20">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search station, city, state..."
              className="flex-1 bg-transparent border-none outline-none text-[13px] font-medium text-slate-900 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Type Filter Segment Bar */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setStationTypeFilter('all')}
              className={`py-1.5 rounded-lg text-micro font-extrabold transition-all ${
                stationTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStationTypeFilter('cng')}
              className={`py-1.5 rounded-lg text-micro font-extrabold transition-all flex items-center justify-center gap-1 ${
                stationTypeFilter === 'cng' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">local_gas_station</span>
              <span>CNG</span>
            </button>
            <button
              onClick={() => setStationTypeFilter('ev_charging')}
              className={`py-1.5 rounded-lg text-micro font-extrabold transition-all flex items-center justify-center gap-1 ${
                stationTypeFilter === 'ev_charging' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">bolt</span>
              <span>⚡ EV</span>
            </button>
          </div>

          <button
            onClick={() => setIsSuggestModalOpen(true)}
            className="w-full py-2 bg-primary hover:bg-deep-teal text-white rounded-xl text-micro font-extrabold shadow-sm active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
            <span>+ Suggest New Station</span>
          </button>
        </div>

        {/* Desktop Station List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredStations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium text-[13px]">
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
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/60 border-primary ring-2 ring-primary/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusInfo.dotColor}`} />
                      <h4 className="font-extrabold text-[14px] text-slate-900 truncate">
                        {station.name}
                      </h4>
                    </div>
                    <span className="text-micro font-extrabold text-primary shrink-0">
                      {station.distance}
                    </span>
                  </div>

                  <p className="text-[12px] font-normal text-slate-500 truncate mt-1">
                    {station.address}
                  </p>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusInfo.badgeBg}`}>
                      {station.statusLabel}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStationDetails(station);
                      }}
                      className="text-micro font-extrabold text-primary hover:underline flex items-center gap-0.5"
                    >
                      <span>Group Chat & Specs</span>
                      <span className="material-symbols-outlined text-[13px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Filter Modal */}
      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Filter Stations">
        <div className="flex flex-col gap-4 py-1 text-on-surface">
          {/* Minimum Pressure */}
          <div>
            <div className="flex justify-between text-caption font-bold text-slate-700 mb-1.5">
              <span>Minimum Pump Pressure</span>
              <span className="text-primary font-extrabold">{minPressure} bar</span>
            </div>
            <input
              type="range"
              min="0"
              max="220"
              step="20"
              value={minPressure}
              onChange={(e) => setMinPressure(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-slate-100 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-micro font-semibold text-slate-400 mt-1">
              <span>Any (0 bar)</span>
              <span>150 bar</span>
              <span>220 bar (Max)</span>
            </div>
          </div>

          {/* Maximum Distance Radius */}
          <div>
            <div className="flex justify-between text-caption font-bold text-slate-700 mb-1.5">
              <span>Maximum Distance Radius</span>
              <span className="text-primary font-extrabold">
                {maxDistanceKm === 0 ? 'Any Distance' : `Within ${maxDistanceKm} km`}
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
              {[0, 5, 10, 25, 50].map((dist) => (
                <button
                  key={dist}
                  type="button"
                  onClick={() => setMaxDistanceKm(dist)}
                  className={`flex-1 py-2 px-2 rounded-xl text-caption font-extrabold border transition-all active:scale-95 ${
                    maxDistanceKm === dist
                      ? 'bg-primary text-white border-primary'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {dist === 0 ? 'Any' : `${dist}km`}
                </button>
              ))}
            </div>
          </div>

          {/* Status checkboxes */}
          <div>
            <label className="block text-caption font-bold text-slate-700 mb-2">
              Fuel &amp; Pump Status Availability
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['all', 'full', 'queue', 'low', 'out'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setActiveFilter(st)}
                  className={`p-2.5 rounded-xl text-caption font-extrabold border transition-all active:scale-95 text-center ${
                    activeFilter === st
                      ? 'bg-primary text-white border-primary'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {st === 'all'
                    ? 'All Statuses'
                    : st === 'full'
                    ? 'Full Stock Only'
                    : st === 'queue'
                    ? 'Queuing'
                    : st === 'low'
                    ? 'Low Pressure'
                    : 'Out of Gas'}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex gap-2.5 mt-1">
            <button
              type="button"
              onClick={() => {
                setMinPressure(0);
                setMaxDistanceKm(0);
                setActiveFilter('all');
                setIsFilterModalOpen(false);
              }}
              className="flex-1 py-3 text-slate-700 font-extrabold text-body bg-slate-100 hover:bg-slate-200 rounded-full active:scale-95 transition-all"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="flex-1 py-3 bg-primary text-white font-extrabold text-body rounded-full shadow-md hover:bg-deep-teal active:scale-95 transition-all"
            >
              Apply Filters
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
