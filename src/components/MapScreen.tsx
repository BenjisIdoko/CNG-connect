import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { GasStation, StationStatus } from '../types';
import { ASSETS } from '../data/mockData';

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
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeCity, setActiveCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [showPiCngInfo, setShowPiCngInfo] = useState(false);
  const [minPressure, setMinPressure] = useState<number>(0);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(0); // 0 = any distance
  const [sheetMode, setSheetMode] = useState<'standard' | 'expanded' | 'collapsed'>('standard');
  const toggleSheetMode = () => setSheetMode((prev) => (prev === 'expanded' ? 'standard' : 'expanded'));
  const [isRecentering, setIsRecentering] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(() => {
    if (propUserGps) return propUserGps;
    try {
      const saved = localStorage.getItem('gasfinder_user_coords');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>(propGpsStatus || 'unavailable');
  const [gpsStatusText, setGpsStatusText] = useState<string>(
    userGps ? `GPS Active: ${userGps.lat.toFixed(4)}°N, ${userGps.lng.toFixed(4)}°E` : 'GPS Location Unavailable (Abuja Default)'
  );

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const initialFitRef = useRef(false);
  const userSelectedRef = useRef(false);

  // Sync propUserGps when parent passes updated coordinates
  useEffect(() => {
    if (propUserGps) {
      setUserGps(propUserGps);
      setGpsStatus('active');
      setGpsStatusText(`GPS Active: ${propUserGps.lat.toFixed(4)}°N, ${propUserGps.lng.toFixed(4)}°E`);
    }
  }, [propUserGps]);

  // Auto-acquire position on mount if userGps is not set
  useEffect(() => {
    if (!userGps && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const coords = { lat: latitude, lng: longitude };
          setUserGps(coords);
          setGpsStatus('active');
          setGpsStatusText(`GPS Active: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`);
          if (onGpsStatusChange) {
            onGpsStatusChange('active', coords);
          }
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([latitude, longitude], 14, { duration: 1.2 });
          }
        },
        () => {
          // silently handle fallback
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

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
      (st.operator && st.operator.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPressure = st.pumpPressure >= minPressure;
    const matchesDistance = maxDistanceKm === 0 || getDistanceKm(st) <= maxDistanceKm;
    return matchesFilter && matchesCity && matchesSearch && matchesPressure && matchesDistance;
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
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

      let colorClass = '#00c853';
      if (st.status === 'queue') colorClass = '#f59e0b';
      if (st.status === 'low') colorClass = '#fe9400';
      if (st.status === 'out') colorClass = '#64748b';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="relative group cursor-pointer flex flex-col items-center">
            <div class="px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-md flex items-center gap-1 transition-transform transform ${isSelected ? 'scale-125' : ''}" style="background-color: ${colorClass};">
              <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span>${st.pumpPressure} bar</span>
            </div>
            <div class="w-2.5 h-2.5 rotate-45 border-r border-b border-white -mt-1 shadow-xs" style="background-color: ${colorClass};"></div>
          </div>
        `,
        iconSize: [60, 30],
        iconAnchor: [30, 30],
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

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserGps({ lat: latitude, lng: longitude });
          setGpsStatus('active');
          setGpsStatusText(`GPS Active: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`);
          showToast(`Live GPS Acquired: ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`);
          if (onGpsStatusChange) {
            onGpsStatusChange('active', { lat: latitude, lng: longitude });
          }
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([latitude, longitude], 14);
          }
          setIsRecentering(false);
        },
        (err) => {
          console.warn('Geolocation permission error or unavailable:', err.message);
          const isDenied = err.code === err.PERMISSION_DENIED;
          const status: GpsStatus = isDenied ? 'denied' : 'unavailable';
          setUserGps(null);
          setGpsStatus(status);
          setGpsStatusText(
            isDenied
              ? 'GPS Permission Denied (Showing Abuja Default)'
              : 'GPS Location Unavailable (Showing Abuja Default)'
          );
          const failMsg = isDenied
            ? "Couldn't get your location — permission denied. Showing Abuja as default."
            : "Couldn't get your location — showing Abuja as default";
          showToast(failMsg);
          if (onGpsStatusChange) {
            onGpsStatusChange(status);
          }
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([9.0765, 7.4853], 13);
          }
          setTimeout(() => setIsRecentering(false), 900);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setUserGps(null);
      setGpsStatus('unavailable');
      setGpsStatusText('GPS Not Supported (Showing Abuja Default)');
      showToast("Couldn't get your location — showing Abuja as default");
      if (onGpsStatusChange) {
        onGpsStatusChange('unavailable');
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([9.0765, 7.4853], 13);
      }
      setTimeout(() => setIsRecentering(false), 900);
    }
  };

  const getStatusIndicator = (status: StationStatus) => {
    switch (status) {
      case 'full':
        return {
          barColor: 'bg-status-green',
          badgeBg: 'bg-surface-container border-outline-variant text-on-surface-variant',
          dotColor: 'bg-status-green',
          label: 'Full stock',
        };
      case 'queue':
        return {
          barColor: 'bg-status-orange',
          badgeBg: 'bg-surface-container border-outline-variant text-on-surface-variant',
          dotColor: 'bg-status-orange',
          label: 'Queuing',
        };
      case 'low':
        return {
          barColor: 'bg-status-orange',
          badgeBg: 'bg-surface-container border-outline-variant text-on-surface-variant',
          dotColor: 'bg-status-orange',
          label: 'Low pressure',
        };
      case 'out':
      default:
        return {
          barColor: 'bg-outline',
          badgeBg: 'bg-surface-container border-outline-variant text-on-surface-variant',
          dotColor: 'bg-outline',
          label: 'Out of gas',
        };
    }
  };

  const activeFilterCount =
    (activeFilter !== 'all' ? 1 : 0) +
    (activeCity !== 'all' ? 1 : 0) +
    (searchQuery.trim() !== '' ? 1 : 0) +
    (minPressure > 0 ? 1 : 0);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-[#eaf4ed]">
      {/* Leaflet Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#141d19]/90 text-white text-[13px] font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-md animate-fade-in pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Top Search & Controls Floating Container */}
      <div className="relative z-30 p-4 max-w-xl mx-auto flex flex-col gap-2 pointer-events-auto">
        {/* Floating Search Pill Bar */}
        <div className="flex items-center bg-white/95 backdrop-blur-xl rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.08)] border border-slate-200/80 p-2 pl-4 gap-2 transition-all focus-within:ring-2 focus-within:ring-emerald-500/30">
          <span className="material-symbols-outlined text-[#006c50] text-[20px] shrink-0">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by station, city, state, or operator..."
            className="flex-1 bg-transparent border-none outline-none text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400"
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
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#00E676] text-[#004D40] text-[9.5px] font-black rounded-full flex items-center justify-center border border-white shadow-xs">
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
                  ? 'bg-[#00c853] hover:bg-emerald-600 shadow-[#00c853]/25'
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
      </div>

          {/* Bottom Sheet: Nearby Petrol Stations Vertical Ranked List & Expanded Gallery */}
      <div className="absolute bottom-0 left-0 right-0 z-30 max-w-xl mx-auto pointer-events-none">
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
                <h3 className="font-extrabold text-[15px] text-on-surface">
                  {filteredStations.length} CNG Stations Near You
                </h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSheetMode();
                }}
                className="text-outline hover:text-on-surface text-[12px] font-bold flex items-center gap-0.5"
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
                  <h4 className="font-extrabold text-on-surface text-[15px]">No CNG Stations Found</h4>
                  <p className="text-[12.5px] text-on-surface-variant font-medium max-w-xs">
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
                    className="mt-1 px-5 py-2.5 bg-primary hover:opacity-95 text-on-primary text-[12.5px] font-extrabold rounded-full shadow-md active:scale-95 transition-all"
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
                        <h3 className="font-black text-[16px] text-on-surface leading-tight">
                          Nearest Stations
                        </h3>
                        <span className="text-[11.5px] font-bold text-outline">
                          Sorted by GPS distance ({sheetMode === 'expanded' ? filteredStations.length : nearestTop5Stations.length} shown)
                        </span>
                      </div>
                      {sheetMode === 'standard' && (
                        <button
                          onClick={() => setSheetMode('expanded')}
                          className="text-[12px] font-extrabold text-primary hover:underline"
                        >
                          See all ({filteredStations.length})
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {(sheetMode === 'expanded' ? filteredStations : nearestTop5Stations).map((station) => {
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
                                <h4 className="font-bold text-[14.5px] text-on-surface truncate leading-snug">
                                  {station.name}
                                </h4>
                                <div className="flex items-center gap-2 text-[12px] text-on-surface-variant mt-0.5">
                                  <span className="font-bold text-primary">{station.distance}</span>
                                  <span>•</span>
                                  <span className="font-medium">{station.statusLabel}</span>
                                  {station.pumpPressure > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="font-semibold text-on-surface-variant">{station.pumpPressure} bar</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
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
                  </div>

                  {/* Secondary Horizontal Carousel (Shown ONLY in Expanded Mode below the vertical list) */}
                  {sheetMode === 'expanded' && (
                    <div className="pt-2 border-t border-outline-variant/40">
                      <div className="flex items-center justify-between mb-2.5 px-1">
                        <h3 className="font-bold text-[15px] text-on-surface">
                          Browse Station Photos
                        </h3>
                        <span className="text-[11.5px] font-semibold text-outline">
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
                                  src={st.photos?.[0] || ASSETS.stationWide}
                                  alt={st.name}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute top-2 left-2 bg-primary/90 backdrop-blur-md text-status-green text-[10px] font-semibold px-2 py-0.5 rounded-full border border-status-green/30">
                                  {st.statusLabel}
                                </span>
                              </div>

                              <h4 className="font-bold text-[14px] text-on-surface truncate leading-snug">
                                {st.name}
                              </h4>
                              <p className="text-[11.5px] font-normal text-on-surface-variant truncate mt-0.5">
                                {st.address}
                              </p>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-outline-variant/30 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
                                <span className="text-secondary font-semibold">★ {st.rating || '4.8'}</span>
                                <span>•</span>
                                <span>{st.distance}</span>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(st);
                                }}
                                className="px-2.5 py-1 bg-status-green text-on-surface rounded-full text-[11px] font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[13px]">navigation</span>
                                <span>Nav</span>
                              </button>
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

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-fade-in border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[20px] text-slate-900">
                Filter Stations
              </h3>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Minimum Pressure */}
              <div>
                <div className="flex justify-between text-[13px] font-bold text-slate-700 mb-1.5">
                  <span>Minimum Pump Pressure</span>
                  <span className="text-[#006c50]">{minPressure} bar</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="220"
                  step="20"
                  value={minPressure}
                  onChange={(e) => setMinPressure(Number(e.target.value))}
                  className="w-full accent-[#006c50]"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>Any (0 bar)</span>
                  <span>150 bar</span>
                  <span>220 bar (Max)</span>
                </div>
              </div>

              {/* Maximum Distance Radius */}
              <div>
                <div className="flex justify-between text-[13px] font-bold text-slate-700 mb-1.5">
                  <span>Maximum Distance</span>
                  <span className="text-[#006c50]">
                    {maxDistanceKm === 0 ? 'Any Distance' : `Within ${maxDistanceKm} km`}
                  </span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                  {[0, 5, 10, 25, 50].map((dist) => (
                    <button
                      key={dist}
                      type="button"
                      onClick={() => setMaxDistanceKm(dist)}
                      className={`flex-1 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                        maxDistanceKm === dist
                          ? 'bg-[#006c50] text-white border-[#006c50]'
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
                <label className="block text-[13px] font-bold text-slate-700 mb-2">
                  Status Availability
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['all', 'full', 'queue', 'low', 'out'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setActiveFilter(st)}
                      className={`p-2.5 rounded-xl text-[12px] font-bold border transition-all ${
                        activeFilter === st
                          ? 'bg-[#006c50] text-white border-[#006c50]'
                          : 'bg-slate-50 text-slate-800 border-slate-200'
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
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setMinPressure(0);
                  setMaxDistanceKm(0);
                  setActiveFilter('all');
                  setIsFilterModalOpen(false);
                }}
                className="flex-1 py-3 text-slate-700 font-bold text-[14px] bg-slate-100 rounded-full hover:bg-slate-200"
              >
                Reset
              </button>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="flex-1 py-3 bg-[#006c50] text-white font-bold text-[14px] rounded-full shadow-md hover:bg-[#004D40]"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
