import React, { useState } from 'react';
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
  const [mapZoom, setMapZoom] = useState<number>(1);
  const [isRecentering, setIsRecentering] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

  // Nearest station is the first station in the filtered/sorted list
  const nearestStation = filteredStations[0] || selectedStation || stations[0];

  const handleRecenter = () => {
    setIsRecentering(true);
    setMapZoom(1);
    showToast('Centered on your current location (Wuse 2, Abuja)');
    setTimeout(() => setIsRecentering(false), 900);
  };

  const handleZoomIn = () => {
    setMapZoom((prev) => Math.min(prev + 0.15, 1.45));
  };

  const handleZoomOut = () => {
    setMapZoom((prev) => Math.max(prev - 0.15, 0.85));
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

  const getPinStyle = (status: StationStatus) => {
    switch (status) {
      case 'full':
        return {
          bg: 'bg-[#006c50]',
          halo: 'bg-[#006c50]/20',
          iconColor: 'text-white',
        };
      case 'low':
        return {
          bg: 'bg-[#fe9400]',
          halo: 'bg-[#fe9400]/20',
          iconColor: 'text-white',
        };
      case 'queue':
        return {
          bg: 'bg-[#f59e0b]',
          halo: 'bg-[#f59e0b]/20',
          iconColor: 'text-white',
        };
      case 'out':
      default:
        return {
          bg: 'bg-slate-500',
          halo: 'bg-slate-500/20',
          iconColor: 'text-white',
        };
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem-4.5rem)] overflow-hidden bg-[#eaf4ed]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#141d19]/90 text-white text-[13px] font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-md animate-fade-in pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Interactive Map Graphic Canvas */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-500 ease-out"
        style={{
          backgroundImage: `url('${ASSETS.abujaMap}')`,
          transform: `scale(${mapZoom}) ${isRecentering ? 'scale(1.08)' : ''}`,
        }}
      >
        {/* Soft road gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#f2fcf5]/70 via-transparent to-[#141d19]/15 pointer-events-none" />

        {/* User Location Radar Pulse & Blue Dot */}
        <div className="absolute top-[52%] left-[48%] -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <div className="relative flex items-center justify-center">
            {/* Outer halo */}
            <div className="w-20 h-20 bg-blue-500/20 rounded-full animate-ping" />
            <div className="absolute w-10 h-10 bg-blue-500/30 rounded-full animate-pulse" />
            {/* Blue dot */}
            <div className="absolute w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
            {/* Micro label */}
            <div className="absolute top-5 whitespace-nowrap bg-white/95 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs border border-blue-200">
              You are here
            </div>
          </div>
        </div>

        {/* Status Pins on Map */}
        {filteredStations.map((station) => {
          const pin = getPinStyle(station.status);
          const isSelected = selectedStation?.id === station.id;

          return (
            <button
              key={station.id}
              onClick={() => {
                onSelectStation(station);
                setSheetMode('standard');
              }}
              style={{
                top: `${station.coordinates.y}%`,
                left: `${station.coordinates.x}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-full z-20 transition-all duration-300 transform active:scale-90 focus:outline-none group ${
                isSelected ? 'scale-125 z-30' : 'hover:scale-110'
              }`}
            >
              <div className="relative flex flex-col items-center">
                {/* Outer halo pulse */}
                <div
                  className={`absolute -inset-1.5 rounded-full ${pin.halo} ${
                    isSelected ? 'animate-ping' : ''
                  }`}
                />

                {/* Pin Circle */}
                <div
                  className={`w-8 h-8 rounded-full ${pin.bg} border-2 border-white shadow-md flex items-center justify-center transition-all ${
                    isSelected ? 'ring-3 ring-[#006c50] shadow-lg' : ''
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[16px] text-white font-bold`}
                  >
                    local_gas_station
                  </span>
                </div>

                {/* Micro badge indicator on selected */}
                {isSelected && (
                  <div className="mt-1 bg-white text-[#141d19] text-[10.5px] font-bold px-2 py-0.5 rounded-md shadow-md border border-slate-200 whitespace-nowrap">
                    {station.name.split(' - ')[0]} • {station.distance}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Top Search & Filter Bar */}
      <div className="relative z-30 p-4 max-w-xl mx-auto flex flex-col gap-2 pointer-events-auto">
        {/* Search Input Bar */}
        <div className="flex items-center bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-[#dbe5de] p-1.5 gap-2 transition-all focus-within:ring-2 focus-within:ring-[#006c50]/30">
          <span className="material-symbols-outlined text-[#3a4a43] pl-2 text-[22px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stations, Abuja, Lagos, Benin, Ibadan..."
            className="flex-1 bg-transparent border-none outline-none text-[14.5px] font-medium text-[#141d19] placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
          <button
            onClick={() => setIsFilterModalOpen(true)}
            aria-label="Filter stations"
            className="p-2.5 bg-[#e6f0e9] hover:bg-[#dbe5de] rounded-xl text-[#006c50] active:scale-95 transition-all flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>

        {/* City / State Filter Selector */}
        <div className="flex overflow-x-auto gap-1.5 pb-0.5 hide-scrollbar -mx-4 px-4">
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
              className={`shrink-0 px-3 py-1 rounded-full text-[12px] font-bold transition-all shadow-2xs active:scale-95 ${
                activeCity === city.id
                  ? 'bg-[#004D40] text-white'
                  : 'bg-white/90 text-slate-700 border border-slate-200 hover:bg-white'
              }`}
            >
              {city.label}
            </button>
          ))}
        </div>

        {/* Filter Chips Horizontal Scroll */}
        <div className="flex overflow-x-auto gap-2 pb-0.5 hide-scrollbar -mx-4 px-4">
          <button
            onClick={() => setActiveFilter('all')}
            className={`shrink-0 px-3 py-1 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 ${
              activeFilter === 'all'
                ? 'bg-[#006c50] text-white'
                : 'bg-white/90 text-slate-700 border border-slate-200 hover:bg-white'
            }`}
          >
            All Status ({filteredStations.length})
          </button>

          <button
            onClick={() => setActiveFilter('full')}
            className={`shrink-0 px-3 py-1 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 ${
              activeFilter === 'full'
                ? 'bg-[#006c50] text-white'
                : 'bg-white/90 text-slate-700 border border-slate-200 hover:bg-white'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
            Full Stock
          </button>

          <button
            onClick={() => setActiveFilter('queue')}
            className={`shrink-0 px-3 py-1 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 ${
              activeFilter === 'queue'
                ? 'bg-[#006c50] text-white'
                : 'bg-white/90 text-slate-700 border border-slate-200 hover:bg-white'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            Queuing
          </button>

          <button
            onClick={() => setActiveFilter('low')}
            className={`shrink-0 px-3 py-1 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 ${
              activeFilter === 'low'
                ? 'bg-[#006c50] text-white'
                : 'bg-white/90 text-slate-700 border border-slate-200 hover:bg-white'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-[#fe9400]" />
            Low Pressure
          </button>

          <button
            onClick={() => setActiveFilter('out')}
            className={`shrink-0 px-3 py-1 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 ${
              activeFilter === 'out'
                ? 'bg-[#006c50] text-white'
                : 'bg-white/90 text-slate-700 border border-slate-200 hover:bg-white'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            Out of Gas
          </button>
        </div>
      </div>

      {/* Floating Zoom & Location Controls on Map Right */}
      <div className="absolute right-4 top-36 z-30 flex flex-col gap-2 pointer-events-auto">
        {/* Zoom In/Out Pill */}
        <div className="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-slate-200 flex flex-col overflow-hidden">
          <button
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-100 font-bold"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
          <button
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors font-bold"
          >
            <span className="material-symbols-outlined text-[20px]">remove</span>
          </button>
        </div>

        {/* Recenter Location Button */}
        <button
          onClick={handleRecenter}
          aria-label="My Location"
          className="w-10 h-10 bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-slate-200 text-[#006c50] flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all"
        >
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            my_location
          </span>
        </button>
      </div>

      {/* Bottom Sheet: Nearest Station & All Closest Gas Stations List */}
      <div className="absolute bottom-0 left-0 right-0 z-30 max-w-xl mx-auto pointer-events-none">
        <div
          className={`w-full bg-white rounded-t-[32px] shadow-[0_-8px_32px_rgba(0,0,0,0.14)] border-t border-slate-200/90 pointer-events-auto transition-all duration-300 flex flex-col ${
            sheetMode === 'expanded'
              ? 'h-[calc(100vh-8rem)]'
              : sheetMode === 'collapsed'
              ? 'h-16'
              : 'max-h-[56vh]'
          }`}
        >
          {/* Drag Handle & Expand Bar */}
          <button
            onClick={() => {
              if (sheetMode === 'collapsed') setSheetMode('standard');
              else if (sheetMode === 'standard') setSheetMode('expanded');
              else setSheetMode('standard');
            }}
            aria-label="Toggle drawer height"
            className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors shrink-0 focus:outline-none"
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full" />
          </button>

          {/* Drawer Scrollable Content */}
          <div className="px-5 pb-6 overflow-y-auto flex-1 hide-scrollbar">
            {/* Presidential CNG Initiative Banner */}
            <div className="mb-4 bg-gradient-to-r from-[#004D40] to-[#006c50] text-white rounded-2xl p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
                  <span className="text-[11.5px] font-black uppercase tracking-wider text-emerald-200">
                    Presidential CNG Initiative (Pi-CNG)
                  </span>
                </div>
                <a
                  href="https://pci.gov.ng/refuelling-stations.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] font-bold bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-full text-white flex items-center gap-1 transition-colors"
                >
                  <span>pci.gov.ng</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              </div>
              <p className="text-[12px] text-emerald-50/90 mt-1 font-medium leading-relaxed">
                Official accredited AutoCNG refuelling stations & conversion network nationwide.
              </p>
            </div>

            {/* Header: Nearest station title & nearby count */}
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="font-extrabold text-[18px] text-slate-900">
                Nearest station
              </h2>
              <span className="text-[13px] font-medium text-slate-500">
                {filteredStations.length} stations nearby
              </span>
            </div>

            {/* Featured Nearest Station Card (Exact Match to Screenshot) */}
            {nearestStation && (
              <div
                onClick={() => {
                  onSelectStation(nearestStation);
                  onOpenStationDetails(nearestStation);
                }}
                className="bg-[#ecf6ef] border border-[#cbe6d4] rounded-2xl p-4 mb-5 flex items-center justify-between cursor-pointer hover:bg-[#e2f1e6] active:scale-[0.99] transition-all group"
              >
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-[16px] text-slate-900 group-hover:text-[#006c50] transition-colors leading-tight">
                      {nearestStation.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#00c853]" />
                      <span className="text-emerald-700 font-semibold">
                        {nearestStation.statusLabel}
                      </span>
                    </div>
                    <span className="text-slate-600 font-medium">
                      {nearestStation.distance}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">
                      Updated {nearestStation.lastUpdated}
                    </span>
                  </div>
                  {nearestStation.isPiCngAccredited && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#006c50]">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>Pi-CNG Accredited • {nearestStation.operator || 'Official Partner'}</span>
                    </div>
                  )}
                </div>

                <span className="material-symbols-outlined text-slate-400 text-[22px] group-hover:translate-x-0.5 group-hover:text-[#006c50] transition-all">
                  chevron_right
                </span>
              </div>
            )}

            {/* All Stations Section Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-[16px] text-slate-900">
                All stations
              </h3>
              {sheetMode !== 'expanded' ? (
                <button
                  onClick={() => setSheetMode('expanded')}
                  className="text-[12.5px] font-bold text-[#006c50] hover:underline"
                >
                  View All ({filteredStations.length})
                </button>
              ) : (
                <button
                  onClick={() => setSheetMode('standard')}
                  className="text-[12.5px] font-bold text-slate-500 hover:underline"
                >
                  Collapse
                </button>
              )}
            </div>

            {/* Closest Stations List */}
            <div className="space-y-3">
              {filteredStations.map((station) => {
                const statusInfo = getStatusIndicator(station.status);
                const isSelected = selectedStation?.id === station.id;

                return (
                  <div
                    key={station.id}
                    onClick={() => {
                      onSelectStation(station);
                    }}
                    className={`bg-white border rounded-2xl p-3.5 shadow-xs flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'border-[#006c50] ring-2 ring-[#006c50]/15 bg-emerald-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Left: Indicator Bar + Details */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      {/* Vertical status colored bar */}
                      <div
                        className={`w-1.5 h-12 rounded-full shrink-0 ${statusInfo.barColor}`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-[15px] text-slate-900 truncate leading-snug">
                            {station.name}
                          </h4>
                        </div>
                        <p className="text-[13px] text-slate-500 truncate mt-0.5">
                          {station.address}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {/* Status badge pill */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11.5px] font-semibold border flex items-center gap-1.5 ${statusInfo.badgeBg}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`}
                            />
                            {station.statusLabel}
                          </span>
                          <span className="text-[12px] font-medium text-slate-600">
                            {station.distance}
                          </span>
                          {station.isPiCngAccredited && (
                            <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">verified</span>
                              Pi-CNG
                            </span>
                          )}
                          {station.pumpPressure > 0 && (
                            <span className="text-[11.5px] font-semibold text-slate-500 hidden xs:inline">
                              • {station.pumpPressure} bar
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Navigate / Details button */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate(station);
                        }}
                        aria-label={`Navigate to ${station.name}`}
                        className="w-10 h-10 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 flex items-center justify-center shadow-xs active:scale-95 transition-all"
                      >
                        <span
                          className="material-symbols-outlined text-[19px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          navigation
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenStationDetails(station);
                        }}
                        aria-label={`View details of ${station.name}`}
                        className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          chevron_right
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredStations.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="material-symbols-outlined text-[36px] text-slate-400 mb-2">
                    search_off
                  </span>
                  <p className="text-[14px] font-bold text-slate-700">
                    No stations found
                  </p>
                  <p className="text-[12px] text-slate-500 mt-1">
                    Try adjusting your filters or search query.
                  </p>
                  <button
                    onClick={() => {
                      setActiveFilter('all');
                      setSearchQuery('');
                      setMinPressure(0);
                    }}
                    className="mt-3 px-4 py-1.5 bg-[#006c50] text-white text-[12px] font-bold rounded-full"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-fade-in border border-[#dbe5de]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-[20px] text-[#141d19]">
                Filter Stations
              </h3>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#6a7b72] hover:bg-[#e6f0e9]"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Minimum Pressure */}
              <div>
                <div className="flex justify-between text-[13px] font-bold text-[#3a4a43] mb-1.5">
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
                <div className="flex justify-between text-[11px] text-[#6a7b72] mt-1">
                  <span>Any (0 bar)</span>
                  <span>150 bar</span>
                  <span>220 bar (Max)</span>
                </div>
              </div>

              {/* Status checkboxes */}
              <div>
                <label className="block text-[13px] font-bold text-[#3a4a43] mb-2">
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
                          : 'bg-[#f2fcf5] text-[#141d19] border-[#dbe5de]'
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
                className="flex-1 py-3 text-[#3a4a43] font-bold text-[14px] bg-[#e6f0e9] rounded-full hover:bg-[#dbe5de]"
              >
                Reset
              </button>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="flex-1 py-3 bg-[#006c50] text-white font-bold text-[14px] rounded-full shadow-md hover:bg-[#006c50]/90"
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
