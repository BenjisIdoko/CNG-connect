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
  const accreditedCount = centers.filter((c) => c.isPiCngAccredited).length;

  return (
    <div data-theme="light" className="pb-32 min-h-screen bg-rd-bg">
      {/* Header + stats — design_handoff_cng_connect_mobile 1j */}
      <div className="px-5 pt-5 pb-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-geist font-bold text-[1.75rem] text-rd-ink tracking-tight">Get converted</h2>

          <div className="mt-3.5 bg-rd-ink rounded-[22px] grid grid-cols-3">
            {[
              { v: accreditedCount.toLocaleString(), l: 'Accredited' },
              { v: String(stateCount), l: 'States' },
              { v: '4–6h', l: 'Typical fit' },
            ].map((t, i) => (
              <div key={t.l} className={`py-3.5 text-center ${i > 0 ? 'border-l border-[#2A3830]' : ''}`}>
                <div className="font-geist font-bold text-[1.625rem] text-white">{t.v}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#A9AFBA] mt-0.5">{t.l}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3.5">
            <div className="flex-1 min-w-0 flex items-center bg-white rounded-full px-4 gap-2.5 h-12 shadow-[0_2px_8px_rgba(20,32,26,0.06)] focus-within:ring-2 focus-within:ring-primary/30">
              <span aria-hidden="true" className="material-symbols-outlined text-rd-text-tertiary text-[20px] shrink-0">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workshops"
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-caption font-medium text-rd-ink placeholder:text-rd-text-tertiary"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="text-rd-text-tertiary shrink-0">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
            <div className="relative shrink-0">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                aria-label="Filter by state"
                className="appearance-none h-12 pl-4 pr-9 rounded-full bg-white shadow-[0_2px_8px_rgba(20,32,26,0.06)] text-caption font-semibold text-rd-ink outline-none max-w-[140px]"
              >
                {statesList.map((st) => (
                  <option key={st} value={st}>
                    {st === 'all' ? 'All states' : st}
                  </option>
                ))}
              </select>
              <span aria-hidden="true" className="material-symbols-outlined text-rd-text-tertiary text-[18px] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3.5">
            <span className="text-caption font-semibold text-rd-ink">
              {filteredCenters.length} centre{filteredCenters.length === 1 ? '' : 's'}
              {selectedState !== 'all' ? ` near ${selectedState}` : ''}
            </span>
            <label className="flex items-center gap-2 text-caption font-semibold text-rd-ink">
              Accredited only
              <button
                type="button"
                onClick={() => setOnlyAccredited(!onlyAccredited)}
                aria-pressed={onlyAccredited}
                aria-label="Toggle accredited only"
                className={`w-10 h-6 rounded-full transition-colors relative ${onlyAccredited ? 'bg-primary' : 'bg-surface-container-highest'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${onlyAccredited ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 pt-1">

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
            filteredCenters.map((center, idx) => (
              <div
                key={center.id}
                className={`bg-white rounded-[24px] p-4 shadow-[0_1px_2px_rgba(20,32,26,0.05),0_8px_24px_rgba(20,32,26,0.05)] flex flex-col${idx < 8 ? ' rise-in' : ''}`}
                style={idx < 8 ? ({ '--d': `${idx * 35}ms` } as React.CSSProperties) : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {center.isPiCngAccredited && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-[#E6F3EC] text-[#006B40] px-1.5 py-1 text-[0.75rem] font-bold">
                        <span aria-hidden="true" className="inline-flex w-[14px] h-[10px] overflow-hidden rounded-[1px]">
                          <span className="flex-1 bg-[#288435]" />
                          <span className="flex-1 bg-white" />
                          <span className="flex-1 bg-[#288435]" />
                        </span>
                        Pi-CNG
                      </span>
                    )}
                    {center.code && (
                      <span className="font-geist-mono text-[0.75rem] text-rd-text-tertiary truncate">{center.code}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-caption font-semibold text-rd-text-tertiary">{center.computedDistance}</span>
                </div>

                <h3 className="font-geist font-bold text-[1.1875rem] text-rd-ink mt-1.5 truncate">{center.name}</h3>
                <p className="text-micro text-rd-text-tertiary mt-0.5 truncate flex items-center gap-1.5">
                  <span className="truncate">{center.address}</span>
                  {center.reviewsCount > 0 && center.rating > 0 && (
                    <span className="shrink-0 flex items-center gap-0.5 text-rd-ink font-semibold">
                      <span aria-hidden="true" className="material-symbols-outlined text-[13px] text-[#F5A623] material-symbols-fill">star</span>
                      {center.rating} ({center.reviewsCount})
                    </span>
                  )}
                </p>

                {center.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {center.services.slice(0, 3).map((srv, idx) => (
                      <span key={idx} className="bg-rd-chip-grey rounded-md px-2 py-0.5 text-[0.75rem] text-rd-ink">
                        {srv}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 text-micro">
                  <span className="font-bold text-rd-ink">{center.conversionPriceRange || 'Contact for pricing'}</span>
                  {Boolean(center.estimatedHours) && <span className="text-rd-text-tertiary"> · ~{center.estimatedHours}</span>}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <a
                    href={`tel:${center.phone}`}
                    aria-label={`Call ${center.name}`}
                    className="shrink-0 w-11 h-11 rounded-full bg-rd-chip-grey text-rd-ink flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">call</span>
                  </a>
                  <button
                    onClick={() => handleOpenDirections(center)}
                    aria-label={`Directions to ${center.name}`}
                    className="shrink-0 w-11 h-11 rounded-full bg-rd-chip-grey text-rd-ink flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">navigation</span>
                  </button>
                  <button
                    onClick={() => onBookAppointment(center)}
                    className="flex-1 h-11 text-center bg-rd-ink text-white rounded-full font-geist text-caption font-bold active:scale-95 transition-transform"
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
