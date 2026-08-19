import React, { useState } from 'react';
import { GasStation } from '../types';

interface StationDetailScreenProps {
  station: GasStation;
  onBack: () => void;
  onOpenReportModal: (station: GasStation) => void;
  onNavigate: (station: GasStation) => void;
  onAddPhoto?: () => void;
}

export const StationDetailScreen: React.FC<StationDetailScreenProps> = ({
  station,
  onBack,
  onOpenReportModal,
  onNavigate,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [reports, setReports] = useState(station.reports);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const handleVote = (reportId: string, type: 'up' | 'down') => {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === reportId) {
          if (type === 'up') {
            const isCurrentlyUp = r.userVoted === 'up';
            return {
              ...r,
              likes: isCurrentlyUp ? r.likes - 1 : r.likes + 1,
              dislikes: r.userVoted === 'down' ? (r.dislikes || 1) - 1 : r.dislikes,
              userVoted: isCurrentlyUp ? null : 'up',
            };
          } else {
            const isCurrentlyDown = r.userVoted === 'down';
            return {
              ...r,
              dislikes: isCurrentlyDown ? (r.dislikes || 1) - 1 : (r.dislikes || 0) + 1,
              likes: r.userVoted === 'up' ? r.likes - 1 : r.likes,
              userVoted: isCurrentlyDown ? null : 'down',
            };
          }
        }
        return r;
      })
    );
  };

  const handleShareStation = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `${station.name} - GasFinder`,
          text: `CNG Status at ${station.name}: ${station.statusLabel}, ₦${station.cngPrice}/kg, Pressure: ${station.pumpPressure} bar.`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(
        `${station.name} (${station.address}): ${station.statusLabel} • ₦${station.cngPrice}/kg • Pressure: ${station.pumpPressure} bar`
      );
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2fcf5] text-[#141d19] pb-32">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#141d19] text-white text-[13px] font-bold px-4 py-2 rounded-full shadow-lg">
          Station details copied!
        </div>
      )}

      {/* Main Content Area */}
      <div className="max-w-xl mx-auto px-4 md:px-6 pt-4 flex flex-col gap-4">
        {/* Header / Title & Status */}
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <h1 className="text-[32px] font-extrabold text-[#141d19] tracking-tight leading-tight">
              {station.name}
            </h1>
            <button
              onClick={handleShareStation}
              className="p-2.5 rounded-full bg-[#e6f0e9] text-[#006c50] hover:bg-[#dbe5de] active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[22px]">share</span>
            </button>
          </div>

          <p className="text-[15px] font-semibold text-[#3a4a43] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#6a7b72] text-[18px]">
              location_on
            </span>
            <span>{station.address}</span>
          </p>

          {/* Badges Container */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {/* Status Badge */}
            <div
              className={`rounded-full px-3.5 py-1.5 flex items-center gap-1.5 shadow-xs ${
                station.status === 'full'
                  ? 'bg-[#00E676] text-white font-extrabold'
                  : station.status === 'low'
                  ? 'bg-[#fe9400] text-white font-extrabold'
                  : station.status === 'queue'
                  ? 'bg-[#FFB800] text-[#141d19] font-extrabold'
                  : 'bg-[#6a7b72] text-white font-extrabold'
              }`}
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {station.status === 'full'
                  ? 'check_circle'
                  : station.status === 'queue'
                  ? 'schedule'
                  : station.status === 'low'
                  ? 'battery_3_bar'
                  : 'not_interested'}
              </span>
              <span className="text-[12px] tracking-wider uppercase font-black">
                {station.statusLabel}
              </span>
            </div>

            {/* Busy Status Badge */}
            <div className="bg-[#ffe149]/30 border border-[#FFB800]/60 rounded-full px-3 py-1.5 flex items-center gap-1.5">
              <span
                className="material-symbols-outlined text-[#6d5e00] text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                groups
              </span>
              <span className="text-[12px] font-bold text-[#746300]">
                {station.busyEstimate}
              </span>
            </div>

            {/* Pi-CNG Badge */}
            {station.isPiCngAccredited && (
              <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-full px-3 py-1.5 flex items-center gap-1.5 font-bold text-[12px]">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Pi-CNG Accredited</span>
              </div>
            )}

            {/* Time / Distance Info */}
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#3a4a43]">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#006c50]">
                  near_me
                </span>
                {station.distance}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[#006c50] font-bold">
                <span className="material-symbols-outlined text-[16px]">
                  schedule
                </span>
                Updated {station.lastUpdated}
              </span>
            </div>
          </div>
        </div>

        {/* Presidential CNG Initiative Partner Verification Box */}
        {station.isPiCngAccredited && (
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-9 h-9 rounded-xl bg-[#006c50] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-[13px] font-extrabold text-emerald-950 truncate">
                  Presidential CNG Initiative (Pi-CNG)
                </h4>
                <p className="text-[11.5px] text-emerald-800 font-medium truncate">
                  Operator: {station.operator || 'Official Pi-CNG Partner'}
                </p>
              </div>
            </div>
            <a
              href="https://pci.gov.ng/refuelling-stations.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#006c50] hover:bg-[#004D40] text-white font-bold text-[11px] rounded-full flex items-center gap-1 shrink-0 transition-colors shadow-xs"
            >
              <span>Verify</span>
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>
          </div>
        )}

        {/* Map / Location Preview */}
        <div className="relative rounded-2xl overflow-hidden shadow-sm border border-[#dbe5de] h-40 bg-[#e6f0e9]">
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url('${station.images[1] || station.images[0]}')` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-4">
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={() => onNavigate(station)}
                  className="bg-[#006c50] hover:bg-[#004D40] text-white px-4 py-2 rounded-full font-bold text-[13px] flex items-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    directions
                  </span>
                  <span>Get Directions</span>
                </button>
                <span className="text-[13px] font-bold text-white drop-shadow-md">
                  {station.distance}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Price & Specs Bento Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* CNG Price */}
          <div className="bg-white rounded-2xl p-4 border border-[#dbe5de] shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-extrabold text-[#6a7b72] uppercase tracking-wider">
              CNG Price
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-[32px] font-extrabold text-[#004D40]">
                ₦{station.cngPrice}
              </span>
              <span className="text-[13px] font-bold text-[#6a7b72]">/kg</span>
            </div>
            <span className="text-[11px] font-bold text-[#00E676] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">
                arrow_downward
              </span>
              <span>{station.priceTrend === 'stable' ? 'Stable' : 'Updated'}</span>
            </span>
          </div>

          {/* Pump Pressure */}
          <div className="bg-white rounded-2xl p-4 border border-[#dbe5de] shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-extrabold text-[#6a7b72] uppercase tracking-wider">
              Pump Pressure
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-[26px] font-extrabold text-[#141d19]">
                {station.pumpPressure}
              </span>
              <span className="text-[13px] font-bold text-[#6a7b72]">bar</span>
            </div>
            <div className="w-full bg-[#e6f0e9] h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  station.pumpPressure >= 190
                    ? 'bg-[#006c50] w-[90%]'
                    : station.pumpPressure >= 140
                    ? 'bg-[#fe9400] w-[65%]'
                    : 'bg-[#ba1a1a] w-[35%]'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Latest Photos Carousel */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h2 className="text-[18px] font-extrabold text-[#141d19]">
              Latest Photos
            </h2>
            <button
              onClick={() => setSelectedPhoto(station.images[0])}
              className="text-[13px] font-bold text-[#006c50] hover:underline"
            >
              View all ({station.images.length})
            </button>
          </div>

          <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 hide-scrollbar">
            {station.images.map((imgUrl, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedPhoto(imgUrl)}
                className="shrink-0 w-36 h-28 rounded-xl overflow-hidden border border-[#dbe5de] shadow-xs cursor-pointer relative group"
              >
                <img
                  src={imgUrl}
                  alt={`Station photo ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {idx === 0 && (
                  <div className="absolute bottom-1.5 right-1.5 bg-[#006c50] text-white p-1 rounded-full shadow-md flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-[12px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      verified
                    </span>
                  </div>
                )}
              </div>
            ))}

            {/* Add Photo Tile */}
            <button
              onClick={() => onOpenReportModal(station)}
              className="shrink-0 w-36 h-28 rounded-xl border-2 border-dashed border-[#b9cbc1] bg-white/60 hover:bg-white flex flex-col items-center justify-center gap-1 text-[#6a7b72] hover:text-[#006c50] transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">
                add_a_photo
              </span>
              <span className="text-[11px] font-bold">Add Photo</span>
            </button>
          </div>
        </div>

        {/* Driver Reports List */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-extrabold text-[#141d19]">
              Driver Reports ({reports.length})
            </h2>
            <span className="text-[12px] font-bold text-[#006c50]">
              Live Feed
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-2xl p-4 border border-[#dbe5de] shadow-xs flex flex-col gap-2"
              >
                {/* Author row */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    {report.authorAvatar ? (
                      <img
                        src={report.authorAvatar}
                        alt={report.author}
                        className="w-10 h-10 rounded-full object-cover border border-[#dbe5de]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#fe9400]/20 text-[#8c5000] font-extrabold flex items-center justify-center text-[16px]">
                        {report.author.charAt(0)}
                      </div>
                    )}

                    <div>
                      <div className="text-[14px] font-bold text-[#141d19] flex items-center gap-1">
                        {report.author}
                        {report.verified && (
                          <span
                            className="material-symbols-outlined text-[#006c50] text-[16px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            verified
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] text-[#6a7b72]">
                        {report.timestamp}
                      </span>
                    </div>
                  </div>

                  {report.isPhotoVerified && (
                    <div className="flex flex-col items-end">
                      <span
                        className="material-symbols-outlined text-[#006c50] text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        verified
                      </span>
                      <span className="text-[9px] font-bold text-[#6a7b72] tracking-wider uppercase">
                        photo verified
                      </span>
                    </div>
                  )}
                </div>

                {/* Status pill & comment */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      report.status === 'full'
                        ? 'bg-[#006c50]'
                        : report.status === 'low'
                        ? 'bg-[#fe9400]'
                        : report.status === 'queue'
                        ? 'bg-[#FFB800]'
                        : 'bg-[#ba1a1a]'
                    }`}
                  />
                  <span className="text-[13px] font-bold text-[#141d19]">
                    {report.statusLabel}{' '}
                    {report.waitMinutes ? `(${report.waitMinutes}m wait)` : ''}
                  </span>
                </div>

                {report.comment && (
                  <p className="text-[14px] text-[#3a4a43] leading-relaxed">
                    {report.comment}
                  </p>
                )}

                {/* Optional Attached Report Photo */}
                {report.photo && (
                  <div
                    onClick={() => setSelectedPhoto(report.photo!)}
                    className="w-32 h-24 rounded-lg overflow-hidden border border-[#dbe5de] mt-1 cursor-pointer"
                  >
                    <img
                      src={report.photo}
                      alt="Report snapshot"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Actions (Like / Dislike) */}
                <div className="flex items-center gap-3 pt-2 border-t border-[#dbe5de]/50 mt-1">
                  <button
                    onClick={() => handleVote(report.id, 'up')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold transition-all ${
                      report.userVoted === 'up'
                        ? 'bg-[#006c50] text-white'
                        : 'bg-[#f2fcf5] text-[#3a4a43] hover:bg-[#e6f0e9]'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{
                        fontVariationSettings:
                          report.userVoted === 'up' ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      thumb_up
                    </span>
                    <span>{report.likes}</span>
                  </button>

                  <button
                    onClick={() => handleVote(report.id, 'down')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold transition-all ${
                      report.userVoted === 'down'
                        ? 'bg-[#ba1a1a] text-white'
                        : 'bg-[#f2fcf5] text-[#3a4a43] hover:bg-[#e6f0e9]'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[16px]"
                      style={{
                        fontVariationSettings:
                          report.userVoted === 'down' ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      thumb_down
                    </span>
                    {report.dislikes ? <span>{report.dislikes}</span> : null}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#f2fcf5] via-[#f2fcf5]/95 to-transparent pb-safe z-40">
        <div className="max-w-xl mx-auto flex flex-col gap-2.5">
          <button
            onClick={() => onOpenReportModal(station)}
            className="w-full h-13 bg-[#006c50] hover:bg-[#004D40] text-white font-extrabold text-[15px] rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">
              edit_document
            </span>
            <span>Report status</span>
          </button>

          <button
            onClick={() => onNavigate(station)}
            className="w-full h-12 bg-white text-[#006c50] border-2 border-[#006c50] hover:bg-[#e6f0e9] font-extrabold text-[15px] rounded-full flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              navigation
            </span>
            <span>Navigate</span>
          </button>
        </div>
      </div>

      {/* Photo Lightbox Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="relative max-w-2xl max-h-[85vh] w-full flex flex-col items-center">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-white p-2 rounded-full hover:bg-white/20"
            >
              <span className="material-symbols-outlined text-[32px]">close</span>
            </button>
            <img
              src={selectedPhoto}
              alt="Station Large View"
              className="w-full h-auto max-h-[75vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
