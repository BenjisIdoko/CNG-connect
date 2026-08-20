import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { GasStation, StationStatus } from '../types';
import { ASSETS } from '../data/mockData';

interface MapScreenProps {
  stations: GasStation[];
  selectedStation: GasStation;
  onSelectStation: (station: GasStation) => void;
  onOpenStationDetails: (station: GasStation) => void;
  onNavigate: (station: GasStation) => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  stations,
  selectedStation,
  onSelectStation,
  onOpenStationDetails,
  onNavigate,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeCity, setActiveCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [showPiCngInfo, setShowPiCngInfo] = useState(false);
  const [minPressure, setMinPressure] = useState<number>(0);
  const [sheetMode, setSheetMode] = useState<'standard' | 'expanded' | 'collapsed'>('standard');
  const [isRecentering, setIsRecentering] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatusText, setGpsStatusText] = useState<string>('Live GPS Ready');

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
    return matchesFilter && matchesCity && matchesSearch && matchesPressure;
  });

  const nearestTop5Stations = [...filteredStations]
    .sort((a, b) => getDistanceKm(a) - getDistanceKm(b))
    .slice(0, 5);

  const nearestStation = nearestTop5Stations[0] || selectedStation || stations[0];

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [9.0765, 7.4853],
      zoom: 13,
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
    if (!mapInstanceRef.current) return;
    if (selectedStation && selectedStation.lat && selectedStation.lng) {
      mapInstanceRef.current.panTo([selectedStation.lat, selectedStation.lng], { animate: true });
    }
  }, [selectedStation]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (activeCity === 'lagos') {
      mapInstanceRef.current.flyTo([6.5821, 3.3791], 12);
    } else if (activeCity === 'edo') {
      mapInstanceRef.current.flyTo([6.3012, 5.6201], 12);
    } else if (activeCity === 'oyo') {
      mapInstanceRef.current.flyTo([7.3512, 3.8901], 12);
    } else if (activeCity === 'abuja' || activeCity === 'all') {
      mapInstanceRef.current.flyTo([9.0765, 7.4853], 13);
    }
  }, [activeCity]);

  const handleRecenter = () => {
    setIsRecentering(true);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserGps({ lat: latitude, lng: longitude });
          setGpsStatusText(`GPS Active: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`);
          showToast(`Live GPS Acquired: ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([latitude, longitude], 14);
          }
          setIsRecentering(false);
        },
        (err) => {
          console.warn('Geolocation permission error or unavailable:', err.message);
          setGpsStatusText('Abuja City Center (Default GPS)');
          showToast('Centered on your current location (Wuse 2, Abuja)');
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([9.0765, 7.4853], 13);
          }
          setTimeout(() => setIsRecentering(false), 900);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      showToast('Centered on your current location (Wuse 2, Abuja)');
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([9.0765, 7.4853], 13);
      }
      setTimeout(() => setIsRecentering(false), 900);
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const getStatusIndicator = (status: StationStatus) => {
    switch (status) {
      case 'full':
        return {
          barColor: 'bg-[#00c853]',
          badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dotColor: 'bg-[#00c853]',
          label: 'Full stock',
        };
      case 'queue':
        return {
          barColor: 'bg-[#f59e0b]',
          badgeBg: 'bg-amber-50 border-amber-200 text-amber-800',
          dotColor: 'bg-[#f59e0b]',
          label: 'Queuing',
        };
      case 'low':
        return {
          barColor: 'bg-[#fe9400]',
          badgeBg: 'bg-orange-50 border-orange-200 text-orange-800',
          dotColor: 'bg-[#fe9400]',
          label: 'Low pressure',
        };
      case 'out':
      default:
        return {
          barColor: 'bg-slate-400',
          badgeBg: 'bg-slate-100 border-slate-200 text-slate-700',
          dotColor: 'bg-slate-400',
          label: 'Out of gas',
        };
    }
  };

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
      <div className="relative z-30 p-4 max-w-xl mx-auto flex flex-col gap-2.5 pointer-events-auto">
        {/* Floating Search Pill Bar */}
        <div className="flex items-center bg-white/95 backdrop-blur-xl rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.08)] border border-slate-200/80 p-2 pl-4 gap-2 transition-all focus-within:ring-2 focus-within:ring-emerald-500/30">
          <span className="material-symbols-outlined text-slate-500 text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find a station by name or location..."
            className="flex-1 bg-transparent border-none outline-none text-[13.5px] font-medium text-slate-900 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            <button
              onClick={() => setIsFilterModalOpen(true)}
              aria-label="Filter stations"
              className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 active:scale-95 transition-all flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>
            <button
              onClick={handleRecenter}
              aria-label="My Location"
              className="w-9 h-9 bg-[#00c853] hover:bg-emerald-600 text-white rounded-full active:scale-95 transition-all flex items-center justify-center shadow-md shadow-[#00c853]/25"
            >
              <span className="material-symbols-outlined text-[18px]">near_me</span>
            </button>
          </div>
        </div>

        {/* City Filter Pills */}
        <div className="flex overflow-x-auto gap-2 pb-0.5 hide-scrollbar -mx-4 px-4">
          {[
            { id: 'all', label: 'All Cities' },
            { id: 'abuja', label: 'Abuja FCT' },
            { id: 'lagos', label: 'Lagos' },
            { id: 'benin', label: 'Benin City' },
            { id: 'ibadan', label: 'Ibadan' },
          ].map((city) => (
            <button
              key={city.id}
              onClick={() => setActiveCity(city.id)}
              className={`shrink-0 px-3.5 py-1 rounded-full text-[11.5px] font-extrabold transition-all shadow-xs active:scale-95 ${
                activeCity === city.id
                  ? 'bg-[#004D40] text-white shadow-sm'
                  : 'bg-white/90 text-slate-700 border border-slate-200 hover:bg-white'
              }`}
            >
              {city.label}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Zoom Controls on Map Right */}
      <div className="absolute right-4 top-36 z-30 flex flex-col gap-2 pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.1)] border border-slate-200/80 flex flex-col overflow-hidden">
          <button
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-100 font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          <button
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
        </div>
      </div>

      {/* Bottom Sheet: Nearby Petrol Stations Horizontal Carousel & List */}
      <div className="absolute bottom-0 left-0 right-0 z-30 max-w-xl mx-auto pointer-events-none">
        <div
          className={`w-full bg-white rounded-t-[32px] shadow-[0_-8px_32px_rgba(0,0,0,0.14)] border-t border-slate-200/90 pointer-events-auto transition-all duration-300 flex flex-col overflow-hidden ${
            sheetMode === 'expanded'
              ? 'h-[calc(100vh-8rem)]'
              : sheetMode === 'collapsed'
              ? 'h-[68px]'
              : 'max-h-[58vh]'
          }`}
        >
          {/* Drag Handle & Top Controls Bar */}
          <div className="w-full pt-3 pb-2 px-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors shrink-0 border-b border-slate-100/60 select-none">
            {sheetMode === 'collapsed' ? (
              <div
                onClick={() => setSheetMode('standard')}
                className="flex items-center gap-2.5 flex-1 min-w-0 pr-2"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-[#00c853] animate-pulse shrink-0" />
                <div className="truncate">
                  <span className="font-extrabold text-[14px] text-slate-900 truncate block">
                    {nearestStation?.name || 'Nearest CNG Station'}
                  </span>
                  <span className="text-[11.5px] font-bold text-[#006c50]">
                    {nearestStation?.distance} • {nearestStation?.statusLabel} (Tap to expand)
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Nearby Petrol Stations
                </span>
              </div>
            )}

            <div
              onClick={() => {
                if (sheetMode === 'collapsed') setSheetMode('standard');
                else if (sheetMode === 'standard') setSheetMode('expanded');
                else setSheetMode('standard');
              }}
              className="w-10 h-1.5 bg-slate-300 rounded-full hover:bg-slate-400 transition-colors mx-auto"
            />

            <button
              onClick={() => {
                if (sheetMode === 'collapsed') setSheetMode('standard');
                else setSheetMode('collapsed');
              }}
              aria-label={sheetMode === 'collapsed' ? 'Expand drawer' : 'Collapse drawer'}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11.5px] font-bold px-2.5 py-1 rounded-full transition-all active:scale-95 shrink-0"
            >
              <span>{sheetMode === 'collapsed' ? 'Expand' : 'Collapse'}</span>
              <span className="material-symbols-outlined text-[16px]">
                {sheetMode === 'collapsed' ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
              </span>
            </button>
          </div>

          {/* Drawer Scrollable Content */}
          {sheetMode !== 'collapsed' && (
            <div className="px-4 pb-20 pt-3 overflow-y-auto flex-1 hide-scrollbar flex flex-col gap-4">
              {/* Section 1: Nearby Petrol Stations Horizontal Carousel */}
              <div>
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <h3 className="font-black text-[17px] text-slate-900">
                    Nearby Petrol Stations
                  </h3>
                  <button
                    onClick={() => setSheetMode('expanded')}
                    className="text-[12.5px] font-extrabold text-[#006c50] hover:underline"
                  >
                    See all
                  </button>
                </div>

                {/* Horizontal Scroll Cards */}
                <div className="flex overflow-x-auto gap-3.5 pb-2 px-1 hide-scrollbar">
                  {nearestTop5Stations.map((st) => (
                    <div
                      key={`carousel-${st.id}`}
                      onClick={() => {
                        onSelectStation(st);
                        onOpenStationDetails(st);
                      }}
                      className="w-56 shrink-0 bg-white rounded-2xl border border-slate-200/80 p-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between active:scale-98"
                    >
                      <div>
                        {/* Hero Image Banner */}
                        <div className="w-full h-24 rounded-xl overflow-hidden relative mb-2 bg-slate-100">
                          <img
                            src={st.photos?.[0] || ASSETS.stationWide}
                            alt={st.name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 left-2 bg-[#004D40]/90 backdrop-blur-md text-[#00E676] text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-400/30">
                            {st.statusLabel}
                          </span>
                        </div>

                        {/* Name & Address */}
                        <h4 className="font-extrabold text-[14px] text-slate-900 truncate leading-snug">
                          {st.name}
                        </h4>
                        <p className="text-[11.5px] font-medium text-slate-500 truncate mt-0.5">
                          {st.address}
                        </p>
                      </div>

                      {/* Footer: Rating, Distance & Time */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                          <span className="text-[#FFB800]">★ {st.rating || '4.8'}</span>
                          <span>•</span>
                          <span>{st.distance}</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(st);
                          }}
                          className="px-2.5 py-1 bg-[#00c853] hover:bg-emerald-600 text-white rounded-full text-[11px] font-black shadow-xs active:scale-95 transition-all flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[13px]">navigation</span>
                          <span>Nav</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Most Nearest Stations Vertical List */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="font-black text-[16px] text-slate-900">
                    Most Nearest
                  </h3>
                  <span className="text-[11.5px] font-bold text-slate-500">
                    5 Closest by GPS
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {nearestTop5Stations.map((station) => {
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
                            ? 'border-[#006c50] ring-2 ring-[#006c50]/15 bg-emerald-50/20'
                            : 'border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusInfo.dotColor}`} />

                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-[14.5px] text-slate-900 truncate leading-snug">
                              {station.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[12px] text-slate-500 mt-0.5">
                              <span>{station.distance}</span>
                              <span>•</span>
                              <span className="font-medium">{station.statusLabel}</span>
                              {station.pumpPressure > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-slate-600">{station.pumpPressure} bar</span>
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
                            className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center active:scale-95 transition-all"
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
                            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
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
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-fade-in border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-[20px] text-slate-900">
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
