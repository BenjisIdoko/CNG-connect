import React, { useState, useEffect } from 'react';
import { ConversionCenter } from '../types';

interface ConversionCentersScreenProps {
  centers: ConversionCenter[];
  onBookAppointment: (center: ConversionCenter) => void;
}

export const ConversionCentersScreen: React.FC<ConversionCentersScreenProps> = ({
  centers,
  onBookAppointment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [onlyAccredited, setOnlyAccredited] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const calculateDistance = (cLat?: number, cLng?: number): string => {
    if (!userLocation || cLat == null || cLng == null) return '2.5 km';
    const R = 6371;
    const dLat = ((cLat - userLocation.lat) * Math.PI) / 180;
    const dLon = ((cLng - userLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((cLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return `${(R * c).toFixed(1)} km`;
  };

  const statesList = ['all', 'Lagos', 'Abuja FCT', 'Ogun', 'Kano', 'Oyo', 'Katsina'];

  const filteredCenters = centers
    .filter((center) => {
      const matchesSearch =
        center.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        center.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        center.lga.toLowerCase().includes(searchQuery.toLowerCase()) ||
        center.code.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesState =
        selectedState === 'all' || center.state.toLowerCase() === selectedState.toLowerCase();

      const matchesAccredited = !onlyAccredited || center.isPiCngAccredited;

      return matchesSearch && matchesState && matchesAccredited;
    })
    .map((c) => ({
      ...c,
      computedDistance: calculateDistance(c.lat, c.lng),
    }))
    .sort((a, b) => parseFloat(a.computedDistance) - parseFloat(b.computedDistance));

  const handleOpenDirections = (center: ConversionCenter) => {
    const daddr = center.lat && center.lng ? `${center.lat},${center.lng}` : encodeURIComponent(center.address);
    window.open(`https://www.google.com/maps/dir//${daddr}`, '_blank');
  };

  return (
    <div className="pb-32 min-h-screen bg-slate-50 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Banner Hero */}
      <div className="bg-gradient-to-b from-deep-teal via-primary to-deep-teal text-white pt-6 pb-8 px-4 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-status-green/20 border border-status-green/40 text-status-green text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 shadow-xs">
            <span className="material-symbols-outlined text-[14px]">verified</span>
            Official Pi-CNG Network (pci.gov.ng)
          </div>

          <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight leading-tight">
            Find CNG Vehicle <br />
            <span className="text-status-green">Conversion Kit Centers</span>
          </h1>
          <p className="text-[13px] text-emerald-100/80 font-normal mt-1.5 max-w-md mx-auto">
            Search certified workshops for dual-fuel CNG kit installation, Italian ECU tuning &amp; 220 bar cylinder safety testing.
          </p>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mt-5 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15">
            <div className="text-center">
              <span className="text-[18px] font-bold text-white block">337+</span>
              <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider">Certified Centers</span>
            </div>
            <div className="text-center border-x border-white/15">
              <span className="text-[18px] font-bold text-status-green block">28</span>
              <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider">States Covered</span>
            </div>
            <div className="text-center">
              <span className="text-[18px] font-bold text-white block">4 - 6 hrs</span>
              <span className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider">Conversion Time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-4 relative z-20 space-y-4">
        {/* Search Bar & Filter Controls */}
        <div className="bg-white rounded-3xl p-3.5 shadow-xl border border-slate-200/80 space-y-3">
          <div className="flex items-center bg-slate-100/90 rounded-full px-4 py-2.5 gap-2.5 focus-within:ring-2 focus-within:ring-emerald-500/30 transition-all">
            <span className="material-symbols-outlined text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search center by name, LGA, state or code (e.g. LA5137YGK)..."
              className="flex-1 bg-transparent border-none outline-none text-[13.5px] font-normal text-slate-900 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* State Filter Pills */}
          <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar">
            {statesList.map((st) => (
              <button
                key={st}
                onClick={() => setSelectedState(st)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-95 ${
                  selectedState.toLowerCase() === st.toLowerCase()
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st === 'all' ? 'All States' : st}
              </button>
            ))}
          </div>

          {/* Toggle Pi-CNG Accredited Only */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[12px] font-semibold text-slate-700">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">workspace_premium</span>
              <span>Pi-CNG Accredited Only</span>
            </div>
            <button
              onClick={() => setOnlyAccredited(!onlyAccredited)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                onlyAccredited ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  onlyAccredited ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Centers Count Header */}
        <div className="flex justify-between items-center px-1">
          <h2 className="text-[16px] font-bold text-slate-900 tracking-tight">
            Accredited Centers ({filteredCenters.length})
          </h2>
          <span className="text-[11.5px] font-normal text-slate-500">
            Pi-CNG Directory
          </span>
        </div>

        {/* Centers Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCenters.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-sm">
              <span className="material-symbols-outlined text-[44px] text-slate-300 mb-2">
                build_circle
              </span>
              <p className="font-bold text-slate-800 text-[15px]">
                No Conversion Centers Found
              </p>
              <p className="text-[13px] font-normal text-slate-500 mt-1">
                Try searching for another state, LGA, or clear your search term.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedState('all');
                  setOnlyAccredited(false);
                }}
                className="mt-3 px-4 py-2 bg-primary text-white text-[12px] font-semibold rounded-full"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredCenters.map((center) => (
              <div
                key={center.id}
                className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 hover:border-emerald-500/50 transition-all flex flex-col gap-3.5 relative overflow-hidden group"
              >
                {/* Center Top Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="bg-emerald-100 text-primary text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Code: {center.code}
                      </span>
                      {center.isPiCngAccredited && (
                        <span className="bg-deep-teal text-status-green text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">verified</span>
                          Pi-CNG Accredited
                        </span>
                      )}
                    </div>

                    <h3 className="text-[15.5px] font-bold text-slate-900 tracking-tight leading-snug truncate">
                      {center.name}
                    </h3>

                    <div className="flex items-center gap-1 text-[12.5px] font-normal text-slate-500 mt-1">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">
                        location_on
                      </span>
                      <span className="truncate">{center.address}</span>
                    </div>
                  </div>

                  {/* Rating Badge */}
                  {center.reviewsCount > 0 && center.rating > 0 ? (
                    <div className="bg-emerald-50 rounded-2xl p-2 text-center border border-emerald-100 shrink-0">
                      <div className="flex items-center gap-0.5 text-primary font-bold text-[13px]">
                        <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          star
                        </span>
                        {center.rating}
                      </div>
                      <span className="text-[10px] font-normal text-slate-400 block">
                        ({center.reviewsCount})
                      </span>
                    </div>
                  ) : (
                    <div className="bg-slate-100 rounded-2xl px-2.5 py-1.5 text-center border border-slate-200/80 shrink-0">
                      <span className="text-[10.5px] font-semibold text-slate-600 block">Not yet rated</span>
                      <span className="text-[9.5px] font-normal text-slate-400 block">0 driver reviews</span>
                    </div>
                  )}
                </div>

                {/* Services Tags Grid */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Certified Installation Services:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {center.services.map((srv, idx) => (
                      <span
                        key={idx}
                        className="bg-white border border-slate-200 text-slate-700 text-[11px] font-medium px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-live-pulse" />
                        {srv}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Price & Duration Bar */}
                <div className="flex items-center justify-between text-[12.5px] px-1 font-semibold">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Est. Cost Range:</span>
                    <span className="text-slate-900 font-bold">
                      {center.conversionPriceRange || 'Contact centre for pricing'}
                    </span>
                  </div>
                  {Boolean(center.estimatedHours) && (
                    <div className="text-right">
                      <span className="text-slate-400 text-[11px] block">Installation Time:</span>
                      <span className="text-primary font-bold">
                        {center.estimatedHours}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                  <a
                    href={`tel:${center.phone}`}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-slate-600">call</span>
                    Call
                  </a>

                  <button
                    onClick={() => handleOpenDirections(center)}
                    className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl font-semibold text-[12px] flex items-center justify-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      near_me
                    </span>
                    Directions
                  </button>

                  <button
                    onClick={() => onBookAppointment(center)}
                    className="py-2.5 bg-deep-teal hover:bg-deep-teal/90 text-white rounded-xl font-bold text-[12.5px] flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">calendar_add_on</span>
                    Book Kit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
