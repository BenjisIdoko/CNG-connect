import React, { useEffect, useRef, useState } from 'react';
import { GasStation, StationStatus, DriverReport, UserProfile } from '../types';
import { verifyImageMetadata, registerSharedImageHash } from '../utils/imageMetadataVerifier';
import { LiveCameraCaptureModal } from './LiveCameraCaptureModal';
import { checkLiveUpdatePermission } from '../utils/permissionManager';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';
import { Modal } from './common/Modal';

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
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [presenceActive, setPresenceActive] = useState<boolean>(isPresenceActive);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setPresenceActive(isPresenceActive);
  }, [isPresenceActive]);

  // Clear pending submit timer if the modal unmounts mid-submit
  useEffect(() => {
    return () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    };
  }, []);

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
      setFormError(perm.reason || 'You need to be at the station to report its status');
      return;
    }
    setFormError(null);

    const isEv = station.stationType === 'ev_charging';

    const statusLabels: Record<StationStatus, string> = isEv
      ? {
          full: 'Reported Available',
          low: 'Reported Busy',
          queue: 'Reported Full (All Ports Occupied)',
          out: 'Reported Out of Service',
          unknown: 'No recent reports',
        }
      : {
          full: 'Reported Full stock',
          low: 'Reported Low pressure',
          queue: 'Reported Queuing',
          out: 'Reported Out of gas',
          unknown: 'No recent reports',
        };

    const isPhotoVerified = Boolean(attachedPhoto);
    // Register the photo hash only NOW (at publish time), not at capture time.
    if (attachedPhoto) {
      registerSharedImageHash(attachedPhoto);
    }

    const newReport: DriverReport = {
      id: `report-${Date.now()}`,
      author: user?.name || 'Anonymous Driver',
      authorAvatar: user?.avatar || '',
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

    setIsSubmitting(true);
    submitTimerRef.current = setTimeout(() => {
      onSubmitReport(newReport, selectedStatus);
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={station.stationType === 'ev_charging' ? "Report EV Charging Hub Status" : "Report CNG Station Status"} className="bg-surface border-surface-container-highest max-h-[90vh] overflow-y-auto">
      <div className="relative w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto border border-surface-container-highest pb-safe">
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 touch-none">
          <div className="w-12 h-1.5 bg-outline-variant rounded-full" />
        </div>

        {/* Content */}
        <div className="px-5 pb-6 pt-1">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wider mb-0.5">
                <span className="material-symbols-outlined text-[15px]">
                  {station.stationType === 'ev_charging' ? 'ev_charger' : 'groups'}
                </span>
                <span>{station.name} Group Feed</span>
                <button
                  type="button"
                  onClick={() => setShowInfoSheet(true)}
                  aria-label="Station Group Policy Info"
                  className="w-5 h-5 rounded-full bg-emerald-100 hover:bg-emerald-200 text-primary flex items-center justify-center transition-all ml-1"
                  title="Policy Info"
                >
                  <span className="material-symbols-outlined text-[13px]">info</span>
                </button>
              </div>
              <h2 className="text-[19px] font-bold text-on-surface leading-snug">
                {station.stationType === 'ev_charging' ? 'Update Charger Availability' : 'Update Gas Availability'}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="w-11 h-11 rounded-full flex items-center justify-center text-outline hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Primary Action Screen: 4 Large Full-Width Status Buttons */}
            <div className="flex flex-col gap-2.5">
              {/* Available / Full Stock */}
              <button
                type="button"
                onClick={() => setSelectedStatus('full')}
                className={`w-full min-h-[58px] py-3.5 px-4 rounded-2xl flex items-center justify-between border-2 transition-all active:scale-[0.98] ${
                  selectedStatus === 'full'
                    ? 'bg-status-green border-status-green text-white shadow-md ring-4 ring-status-green/30'
                    : 'bg-status-green-container border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {station.stationType === 'ev_charging' ? 'ev_charger' : 'local_gas_station'}
                  </span>
                  <span className="text-[16px] font-extrabold">
                    {station.stationType === 'ev_charging' ? 'Available (Fast Chargers Free)' : 'Full stock (Fast pump)'}
                  </span>
                </div>
                {selectedStatus === 'full' && (
                  <span className="material-symbols-outlined text-[22px] text-white">check_circle</span>
                )}
              </button>

              {/* Busy / Queuing */}
              <button
                type="button"
                onClick={() => setSelectedStatus('queue')}
                className={`w-full min-h-[58px] py-3.5 px-4 rounded-2xl flex items-center justify-between border-2 transition-all active:scale-[0.98] ${
                  selectedStatus === 'queue'
                    ? 'bg-status-orange border-status-orange text-white shadow-md ring-4 ring-status-orange/30'
                    : 'bg-status-orange-container border-amber-200 text-amber-950 hover:bg-amber-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {station.stationType === 'ev_charging' ? 'charging_station' : 'schedule'}
                  </span>
                  <span className="text-[16px] font-extrabold">
                    {station.stationType === 'ev_charging' ? 'Busy (Partially Occupied)' : 'Long queue / Queuing'}
                  </span>
                </div>
                {selectedStatus === 'queue' && (
                  <span className="material-symbols-outlined text-[22px] text-white">check_circle</span>
                )}
              </button>

              {/* All Ports Occupied / Low Pressure */}
              <button
                type="button"
                onClick={() => setSelectedStatus('low')}
                className={`w-full min-h-[58px] py-3.5 px-4 rounded-2xl flex items-center justify-between border-2 transition-all active:scale-[0.98] ${
                  selectedStatus === 'low'
                    ? 'bg-status-orange border-status-orange text-white shadow-md ring-4 ring-status-orange/30'
                    : 'bg-status-orange-container border-orange-200 text-orange-950 hover:bg-orange-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {station.stationType === 'ev_charging' ? 'electric_car' : 'battery_3_bar'}
                  </span>
                  <span className="text-[16px] font-extrabold">
                    {station.stationType === 'ev_charging' ? 'Full (All Ports Occupied)' : 'Low pressure'}
                  </span>
                </div>
                {selectedStatus === 'low' && (
                  <span className="material-symbols-outlined text-[22px] text-white">check_circle</span>
                )}
              </button>

              {/* Out of Service / Out of Gas */}
              <button
                type="button"
                onClick={() => setSelectedStatus('out')}
                className={`w-full min-h-[58px] py-3.5 px-4 rounded-2xl flex items-center justify-between border-2 transition-all active:scale-[0.98] ${
                  selectedStatus === 'out'
                    ? 'bg-status-red border-status-red text-white shadow-md ring-4 ring-status-red/30'
                    : 'bg-status-red-container border-rose-200 text-rose-950 hover:bg-rose-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {station.stationType === 'ev_charging' ? 'power_off' : 'not_interested'}
                  </span>
                  <span className="text-[16px] font-extrabold">
                    {station.stationType === 'ev_charging' ? 'Out of Service / Offline' : 'Out of gas'}
                  </span>
                </div>
                {selectedStatus === 'out' && (
                  <span className="material-symbols-outlined text-[22px] text-white">check_circle</span>
                )}
              </button>
            </div>

            {/* Optional Secondary Expandable Section: Wait time, Photo, Note */}
            <div className="pt-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => setShowMoreDetails(!showMoreDetails)}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[13px] font-bold rounded-2xl flex items-center justify-between transition-colors active:scale-98"
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  <span>Add details: Wait time, Photo, Note (Optional)</span>
                </span>
                <span className="material-symbols-outlined text-[18px]">
                  {showMoreDetails ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {showMoreDetails && (
                <div className="flex flex-col gap-3 mt-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  {/* Wait Time Stepper */}
                  <div>
                    <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                      Wait time estimate (Optional)
                    </label>
                    <div className="flex items-center justify-between bg-surface-container rounded-2xl p-1.5 px-3 border border-surface-container-highest">
                      <button
                        type="button"
                        onClick={() => setWaitTime((t) => Math.max(0, t - 5))}
                        aria-label="Decrease wait time estimate by 5 minutes"
                        className="w-10 h-10 flex items-center justify-center text-on-surface hover:bg-white rounded-full transition-colors active:scale-90"
                      >
                        <span className="material-symbols-outlined text-[22px]">remove</span>
                      </button>
                      <div className="text-[16px] font-extrabold text-on-surface">
                        {waitTime} min
                      </div>
                      <button
                        type="button"
                        onClick={() => setWaitTime((t) => Math.min(120, t + 5))}
                        aria-label="Increase wait time estimate by 5 minutes"
                        className="w-10 h-10 flex items-center justify-center text-on-surface hover:bg-white rounded-full transition-colors active:scale-90"
                      >
                        <span className="material-symbols-outlined text-[22px]">add</span>
                      </button>
                    </div>
                  </div>

                  {/* Optional Live Camera Snapshot */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[12.5px] font-bold text-slate-700">
                        Live Photo of Pump (Camera Only)
                      </label>
                      <span className="text-[10px] font-bold text-primary bg-emerald-100 px-2 py-0.5 rounded-full">
                        Gallery Blocked
                      </span>
                    </div>

                    {photoError && (
                      <div role="alert" className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[12px] font-medium flex items-start gap-2">
                        <span className="material-symbols-outlined text-[16px] shrink-0 text-rose-600">gpp_bad</span>
                        <span>{photoError}</span>
                      </div>
                    )}

                    {attachedPhoto ? (
                      <div className="relative rounded-xl overflow-hidden border-2 border-primary max-h-36 bg-black/10">
                        <img src={attachedPhoto} alt="Verified meter snapshot" className="w-full h-32 object-cover" />
                        <div className="absolute bottom-2 left-2 bg-deep-teal/90 text-status-green text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 border border-emerald-400/40">
                          <span className="material-symbols-outlined text-[13px]">verified</span>
                          Live Camera Verified
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachedPhoto(null);
                            setPhotoError(null);
                          }}
                          aria-label="Delete attached photo"
                          className="absolute top-2 right-2 w-9 h-9 bg-black/70 text-white rounded-full hover:bg-black flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowLiveCamera(true)}
                        className="w-full py-3 px-4 bg-deep-teal hover:bg-primary text-white rounded-xl font-bold text-[13px] shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[20px] text-status-green">photo_camera</span>
                        <span>Take Live Camera Photo</span>
                      </button>
                    )}
                  </div>

                  {/* Notes / Comment Input */}
                  <div>
                    <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                      Driver Note / Observation
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="e.g. Line moving fast, POS terminal active..."
                      rows={2}
                      className="w-full bg-surface-container border border-surface-container-highest rounded-xl p-2.5 text-[13.5px] text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              )}
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

            {formError && (
              <div role="alert" className="bg-rose-50 rounded-2xl p-3 border border-rose-200 text-rose-700 text-[12px] font-semibold flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0 text-rose-600">error</span>
                <span>{formError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!presenceActive || isSubmitting}
              className="w-full h-13 flex items-center justify-center bg-primary hover:bg-deep-teal text-white rounded-full font-extrabold text-[15px] shadow-md active:scale-[0.98] transition-all disabled:opacity-50 mt-1"
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
            // Freshness/duplicate CHECK at capture time (registration happens
            // only when the report is actually submitted).
            const verification = verifyImageMetadata(undefined, dataUrl);
            if (!verification.isValid) {
              setPhotoError(verification.reason || 'Photo rejected by anti-misinformation check.');
              setShowLiveCamera(false);
              return;
            }
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
    </Modal>
  );
};
