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

  const stateCount = new Set(centers.map((c) => c.state)).size;

  return (
    <div className="pb-32 min-h-screen bg-surface-container font-['Urbanist',sans-serif]">
      {/* Header + stats */}
      <div className="bg-white px-5 pt-5 pb-4 shadow-[0_2px_10px_rgba(14,20,32,0.04)]">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-bold text-title tracking-tight">Conversion Centres</h1>
          <div className="flex gap-2 mt-3">
            {[
              { v: centers.length.toLocaleString(), l: 'Centres' },
              { v: String(stateCount), l: 'States' },
              { v: '4–6h', l: 'Avg install' },
            ].map((t) => (
              <div key={t.l} className="flex-1 bg-surface rounded-xl py-2.5 text-center">
                <div className="font-extrabold text-body-lg">{t.v}</div>
                <div className="text-[10px] text-outline">{t.l}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center bg-surface rounded-full px-4 gap-2.5 mt-4 focus-within:ring-2 focus-within:ring-primary/30">
            <span className="material-symbols-outlined text-outline text-[20px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search centre, LGA, state or code"
              className="flex-1 bg-transparent border-none outline-none text-caption font-medium text-slate-900 placeholder:text-outline py-3"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="text-outline">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          <div className="flex overflow-x-auto gap-2 mt-3 hide-scrollbar">
            {statesList.map((st) => (
              <button
                key={st}
                onClick={() => setSelectedState(st)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-micro font-semibold transition-all active:scale-95 ${
                  selectedState.toLowerCase() === st.toLowerCase()
                    ? 'bg-slate-900 text-white'
                    : 'bg-surface text-slate-500'
                }`}
              >
                {st === 'all' ? 'All states' : st}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3 text-caption font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#B4890B] text-[18px]">workspace_premium</span>
              Accredited only
            </span>
            <button
              onClick={() => setOnlyAccredited(!onlyAccredited)}
              aria-pressed={onlyAccredited}
              aria-label="Toggle accredited only"
              className={`w-[38px] h-[22px] rounded-full transition-colors relative ${onlyAccredited ? 'bg-primary' : 'bg-surface-container-highest'}`}
            >
              <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all ${onlyAccredited ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 pt-4">
        <p className="text-caption font-semibold text-outline mb-3">{filteredCenters.length} centres</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCenters.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center col-span-full">
              <p className="font-bold text-body-lg">No centres found</p>
              <p className="text-caption text-outline mt-1">Try another state or clear your search.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedState('all');
                  setOnlyAccredited(false);
                }}
                className="mt-4 px-5 py-2.5 bg-primary text-white text-caption font-bold rounded-full"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredCenters.map((center) => (
              <div
                key={center.id}
                className="bg-white rounded-2xl p-4 shadow-[0_4px_14px_rgba(14,20,32,0.05)] flex flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-body text-slate-900 truncate">{center.name}</h3>
                      {center.isPiCngAccredited && (
                        <span className="bg-[#FDF6E3] text-[#B4890B] rounded-md px-1.5 py-0.5 text-[9px] font-bold shrink-0">
                          Accredited
                        </span>
                      )}
                    </div>
                    <p className="text-micro text-outline mt-1 truncate">
                      {center.address} · {center.computedDistance}
                    </p>
                  </div>
                  {center.reviewsCount > 0 && center.rating > 0 && (
                    <span className="text-caption text-outline shrink-0 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[14px] text-[#F5A623] material-symbols-fill">star</span>
                      {center.rating}
                    </span>
                  )}
                </div>

                {center.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {center.services.slice(0, 3).map((srv, idx) => (
                      <span key={idx} className="bg-surface rounded-md px-2 py-0.5 text-[10px] text-slate-600">
                        {srv}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-between mt-3 text-micro text-on-surface-variant">
                  <span>{center.conversionPriceRange || 'Contact for pricing'}</span>
                  {Boolean(center.estimatedHours) && <span>~{center.estimatedHours}</span>}
                </div>

                <div className="flex gap-1.5 mt-3">
                  <a
                    href={`tel:${center.phone}`}
                    className="flex-1 text-center bg-surface rounded-full py-2.5 text-micro font-semibold text-slate-900 active:scale-95 transition-transform"
                  >
                    Call
                  </a>
                  <button
                    onClick={() => handleOpenDirections(center)}
                    className="flex-1 text-center bg-surface rounded-full py-2.5 text-micro font-semibold text-slate-900 active:scale-95 transition-transform"
                  >
                    Directions
                  </button>
                  <button
                    onClick={() => onBookAppointment(center)}
                    className="flex-1 text-center bg-primary text-white rounded-full py-2.5 text-micro font-semibold active:scale-95 transition-transform"
                  >
                    Book
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
