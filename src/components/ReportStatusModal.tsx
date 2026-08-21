import React, { useState } from 'react';
import { GasStation, StationStatus, DriverReport, UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import { verifyImageMetadata } from '../utils/imageMetadataVerifier';
import { LiveCameraCaptureModal } from './LiveCameraCaptureModal';
import { checkLiveUpdatePermission } from '../utils/permissionManager';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';

interface ReportStatusModalProps {
  station: GasStation;
  user?: UserProfile;
  onClose: () => void;
  onSubmitReport: (newReport: DriverReport, updatedStationStatus: StationStatus) => void;
  isPresenceActive?: boolean;
}

export const ReportStatusModal: React.FC<ReportStatusModalProps> = ({
  station,
  user,
  onClose,
  onSubmitReport,
  isPresenceActive = true,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<StationStatus>('full');
  const [waitTime, setWaitTime] = useState<number>(15);
  const [comment, setComment] = useState<string>('');
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [presenceActive, setPresenceActive] = useState<boolean>(isPresenceActive);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Run anti-misinformation metadata verification
      const verification = verifyImageMetadata(file, undefined, 30);
      if (!verification.isValid) {
        setPhotoError(verification.reason || 'Gallery photo rejected. Live camera capture required.');
        setAttachedPhoto(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const urlVerification = verifyImageMetadata(undefined, dataUrl);
        if (!urlVerification.isValid) {
          setPhotoError(urlVerification.reason || 'Duplicate old photo detected.');
          setAttachedPhoto(null);
          return;
        }

        setPhotoError(null);
        setAttachedPhoto(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const perm = checkLiveUpdatePermission(presenceActive);
    if (!perm.allowed) {
      setPhotoError(perm.reason || 'You need to be at the station to report its status');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);

    const statusLabels: Record<StationStatus, string> = {
      full: 'Reported Full stock',
      low: 'Reported Low pressure',
      queue: 'Reported Queuing',
      out: 'Reported Out of gas',
    };

    const isPhotoVerified = Boolean(attachedPhoto);

    const newReport: DriverReport = {
      id: `report-${Date.now()}`,
      author: user?.name || 'Tunde Adebayo',
      authorAvatar: user?.avatar || ASSETS.userAvatar,
      verified: isPhotoVerified,
      isPhotoVerified: isPhotoVerified,
      timestamp: 'Just now',
      status: selectedStatus,
      statusLabel: statusLabels[selectedStatus],
      waitMinutes: waitTime,
      comment: comment.trim() || undefined,
      likes: 1,
      userVoted: 'up',
      photo: attachedPhoto || undefined,
    };

    setTimeout(() => {
      onSubmitReport(newReport, selectedStatus);
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Scrim Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#29322e]/50 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Bottom Sheet */}
      <div className="relative w-full max-w-lg bg-[#f2fcf5] rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto border border-[#dbe5de] pb-safe animate-slide-up">
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 touch-none">
          <div className="w-12 h-1.5 bg-[#b9cbc1] rounded-full" />
        </div>

        {/* Content */}
        <div className="px-5 pb-6 pt-1">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#006c50] uppercase tracking-wider mb-0.5">
                <span className="material-symbols-outlined text-[15px]">groups</span>
                <span>{station.name} Group Feed</span>
                <button
                  type="button"
                  onClick={() => setShowInfoSheet(true)}
                  aria-label="Station Group Policy Info"
                  className="w-5 h-5 rounded-full bg-emerald-100 hover:bg-emerald-200 text-[#006c50] flex items-center justify-center transition-all ml-1"
                  title="Policy Info"
                >
                  <span className="material-symbols-outlined text-[13px]">info</span>
                </button>
              </div>
              <h2 className="text-[19px] font-bold text-[#141d19] leading-snug">
                Update Gas Availability
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#6a7b72] hover:bg-[#e6f0e9]"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 4 Status Selector Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Full Stock */}
              <button
                type="button"
                onClick={() => setSelectedStatus('full')}
                className={`relative flex flex-col items-start p-4 rounded-2xl transition-all border-2 text-left active:scale-[0.98] ${
                  selectedStatus === 'full'
                    ? 'bg-[#e6f0e9] border-[#006c50] shadow-sm ring-2 ring-[#006c50]/20'
                    : 'bg-[#e6f0e9]/60 border-transparent hover:bg-[#e6f0e9]'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[#006c50] mb-2 text-[26px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  local_gas_station
                </span>
                <span className="text-[14px] font-bold text-[#141d19]">
                  Full stock
                </span>
                {selectedStatus === 'full' && (
                  <div className="absolute top-3.5 right-3.5 w-3 h-3 bg-[#006c50] rounded-full animate-pulse" />
                )}
              </button>

              {/* Low Pressure */}
              <button
                type="button"
                onClick={() => setSelectedStatus('low')}
                className={`relative flex flex-col items-start p-4 rounded-2xl transition-all border-2 text-left active:scale-[0.98] ${
                  selectedStatus === 'low'
                    ? 'bg-[#e6f0e9] border-[#fe9400] shadow-sm ring-2 ring-[#fe9400]/20'
                    : 'bg-[#e6f0e9]/60 border-transparent hover:bg-[#e6f0e9]'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[#FF6D00] mb-2 text-[26px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  battery_3_bar
                </span>
                <span className="text-[14px] font-bold text-[#141d19]">
                  Low pressure
                </span>
                {selectedStatus === 'low' && (
                  <div className="absolute top-3.5 right-3.5 w-3 h-3 bg-[#FF6D00] rounded-full" />
                )}
              </button>

              {/* Queuing */}
              <button
                type="button"
                onClick={() => setSelectedStatus('queue')}
                className={`relative flex flex-col items-start p-4 rounded-2xl transition-all border-2 text-left active:scale-[0.98] ${
                  selectedStatus === 'queue'
                    ? 'bg-[#e6f0e9] border-[#FFB800] shadow-sm ring-2 ring-[#FFB800]/20'
                    : 'bg-[#e6f0e9]/60 border-transparent hover:bg-[#e6f0e9]'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[#FFB800] mb-2 text-[26px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  schedule
                </span>
                <span className="text-[14px] font-bold text-[#141d19]">
                  Queuing
                </span>
                {selectedStatus === 'queue' && (
                  <div className="absolute top-3.5 right-3.5 w-3 h-3 bg-[#FFB800] rounded-full" />
                )}
              </button>

              {/* Out of Gas */}
              <button
                type="button"
                onClick={() => setSelectedStatus('out')}
                className={`relative flex flex-col items-start p-4 rounded-2xl transition-all border-2 text-left active:scale-[0.98] ${
                  selectedStatus === 'out'
                    ? 'bg-[#e6f0e9] border-[#ba1a1a] shadow-sm ring-2 ring-[#ba1a1a]/20'
                    : 'bg-[#e6f0e9]/60 border-transparent hover:bg-[#e6f0e9]'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[#ba1a1a] mb-2 text-[26px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  not_interested
                </span>
                <span className="text-[14px] font-bold text-[#141d19]">
                  Out of gas
                </span>
                {selectedStatus === 'out' && (
                  <div className="absolute top-3.5 right-3.5 w-3 h-3 bg-[#ba1a1a] rounded-full" />
                )}
              </button>
            </div>

            {/* Wait Time Stepper */}
            <div>
              <label className="block text-[13px] font-semibold text-[#3a4a43] mb-1.5">
                Wait time estimate
              </label>
              <div className="flex items-center justify-between bg-[#e6f0e9] rounded-2xl p-2 px-3 border border-[#dbe5de]">
                <button
                  type="button"
                  onClick={() => setWaitTime((t) => Math.max(0, t - 5))}
                  className="w-11 h-11 flex items-center justify-center text-[#141d19] hover:bg-white rounded-full transition-colors active:scale-90"
                >
                  <span className="material-symbols-outlined text-[24px]">remove</span>
                </button>
                <div className="text-[18px] font-extrabold text-[#141d19]">
                  {waitTime} min
                </div>
                <button
                  type="button"
                  onClick={() => setWaitTime((t) => Math.min(120, t + 5))}
                  className="w-11 h-11 flex items-center justify-center text-[#141d19] hover:bg-white rounded-full transition-colors active:scale-90"
                >
                  <span className="material-symbols-outlined text-[24px]">add</span>
                </button>
              </div>
            </div>

            {/* Live Camera Snapshot of Pump Meter */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-semibold text-[#3a4a43]">
                  Live Photo of Pump Meter (Camera Only)
                </label>
                <span className="text-[10px] font-semibold text-[#006c50] bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00c853] animate-pulse" />
                  Gallery Blocked
                </span>
              </div>

              {photoError && (
                <div className="mb-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[12px] font-medium flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0 text-rose-600">
                    gpp_bad
                  </span>
                  <span>{photoError}</span>
                </div>
              )}

              {attachedPhoto ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-[#006c50] max-h-40 bg-black/10">
                  <img
                    src={attachedPhoto}
                    alt="Verified meter snapshot"
                    className="w-full h-36 object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-[#004D40]/90 text-[#00E676] text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 border border-emerald-400/40">
                    <span className="material-symbols-outlined text-[13px]">verified</span>
                    Live Camera Verified
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedPhoto(null);
                      setPhotoError(null);
                    }}
                    className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Live HTML5 Viewfinder Camera Trigger - 100% Gallery Blocked */}
                  <button
                    type="button"
                    onClick={() => setShowLiveCamera(true)}
                    className="w-full py-3.5 px-4 bg-[#004D40] hover:bg-[#006c50] text-white rounded-2xl font-bold text-[14px] shadow-md flex items-center justify-center gap-2.5 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[24px] text-[#00E676]">
                      photo_camera
                    </span>
                    <span>Take Live Camera Photo (Gallery Blocked)</span>
                  </button>
                  <p className="text-[11px] font-normal text-[#6a7b72] text-center">
                    🔒 Photo gallery access is disabled to prevent old/fake queue reports.
                  </p>
                </div>
              )}
            </div>

            {/* Notes / Comment Input */}
            <div>
              <label className="block text-[13px] font-semibold text-[#3a4a43] mb-1.5">
                Driver Note / Observation
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Pump 2 working fast, POS terminal active, line moving smoothly..."
                rows={2}
                className="w-full bg-[#e6f0e9] border border-[#dbe5de] rounded-2xl p-3 text-[14px] font-normal text-[#141d19] placeholder:text-[#6a7b72] focus:outline-none focus:ring-2 focus:ring-[#006c50]/30"
              />
            </div>

            {/* Presence Gate Warning Banner */}
            {!presenceActive && (
              <div className="bg-rose-50 rounded-2xl p-3.5 border border-rose-200 text-rose-900 text-[12.5px] font-bold flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[24px] text-rose-600 shrink-0">location_off</span>
                <div className="flex-1">
                  <strong className="block text-[13px] text-rose-800 font-extrabold mb-0.5">Presence Verification Required</strong>
                  <span>You need to be at the station to report its status. Live updates require active GPS presence within the station geofence radius.</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!presenceActive || isSubmitting}
              className="w-full h-13 flex items-center justify-center bg-[#006c50] hover:bg-[#004D40] text-white rounded-full font-extrabold text-[15px] shadow-md active:scale-[0.98] transition-all disabled:opacity-50 mt-1"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="whitespace-nowrap">Submitting...</span>
                </div>
              ) : (
                <span className="whitespace-nowrap">Submit Report</span>
              )}
            </button>
          </form>
        </div>
      </div>

      {showLiveCamera && (
        <LiveCameraCaptureModal
          title={`Live Photo of ${station.name}`}
          onCapture={(dataUrl) => {
            setAttachedPhoto(dataUrl);
            setPhotoError(null);
            setShowLiveCamera(false);
          }}
          onClose={() => setShowLiveCamera(false)}
        />
      )}

      <StationGroupInfoSheet
        isOpen={showInfoSheet}
        onClose={() => setShowInfoSheet(false)}
      />
    </div>
  );
};
