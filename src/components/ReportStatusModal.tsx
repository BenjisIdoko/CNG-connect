import React, { useEffect, useRef, useState } from 'react';
import { GasStation, StationStatus, DriverReport, UserProfile } from '../types';
import { verifyImageMetadata, registerSharedImageHash } from '../utils/imageMetadataVerifier';
import { LiveCameraCaptureModal } from './LiveCameraCaptureModal';
import { checkLiveUpdatePermission } from '../utils/permissionManager';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';
import { Modal } from './common/Modal';
import { compressImageToDataUrl } from '../utils/compressImage';

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

      compressImageToDataUrl(file).then((dataUrl) => {
        const urlVerification = verifyImageMetadata(undefined, dataUrl);
        if (!urlVerification.isValid) {
          setPhotoError(urlVerification.reason || 'Duplicate old photo detected.');
          setAttachedPhoto(null);
          return;
        }

        setPhotoError(null);
        setAttachedPhoto(dataUrl);
      });
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
      timestamp: new Date().toISOString(),
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

  const isEv = station.stationType === 'ev_charging';
  const statusOptions: { key: StationStatus; title: string; meaning: string; icon: string; solid: string; container: string }[] = isEv
    ? [
        { key: 'full', title: 'Available', meaning: 'Charger free, plug in now', icon: 'check_circle', solid: 'bg-rd-available', container: 'bg-rd-available-container' },
        { key: 'queue', title: 'Busy', meaning: 'Charging, expect a wait', icon: 'schedule', solid: 'bg-rd-queuing', container: 'bg-rd-queuing-container' },
        { key: 'low', title: 'All ports occupied', meaning: 'Every port is in use', icon: 'speed', solid: 'bg-rd-low', container: 'bg-rd-low-container' },
        { key: 'out', title: 'Out of service', meaning: 'Not charging right now', icon: 'block', solid: 'bg-rd-out', container: 'bg-rd-out-container' },
      ]
    : [
        { key: 'full', title: 'Available', meaning: 'Full stock, no wait', icon: 'check_circle', solid: 'bg-rd-available', container: 'bg-rd-available-container' },
        { key: 'queue', title: 'Queuing', meaning: 'Gas is flowing, expect a wait', icon: 'schedule', solid: 'bg-rd-queuing', container: 'bg-rd-queuing-container' },
        { key: 'low', title: 'Low pressure', meaning: "Slow fill, tank won't top up", icon: 'speed', solid: 'bg-rd-low', container: 'bg-rd-low-container' },
        { key: 'out', title: 'Out of gas', meaning: 'Not dispensing right now', icon: 'block', solid: 'bg-rd-out', container: 'bg-rd-out-container' },
      ];

  return (
    <Modal isOpen={true} onClose={onClose} title={`Report status for ${station.name}`} bare className="bg-white max-h-[90vh] overflow-y-auto">
      <div data-theme="light" className="relative w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-3xl z-10 max-h-[90vh] overflow-y-auto pb-safe">
        <div className="px-5 pb-6 pt-7">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <p className="font-geist-mono text-[11px] font-medium tracking-[0.08em] uppercase text-rd-text-tertiary truncate flex items-center gap-1.5">
                {station.name}
                <button
                  type="button"
                  onClick={() => setShowInfoSheet(true)}
                  aria-label="Station Group Policy Info"
                  className="text-outline/70 hover:text-outline shrink-0"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[14px]">info</span>
                </button>
              </p>
              <h1 className="font-geist text-[1.625rem] font-bold text-rd-ink tracking-tight leading-tight mt-0.5">
                {isEv ? "How's the charger now?" : "How's the pump now?"}
              </h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-10 h-10 rounded-full bg-surface-container text-rd-ink flex items-center justify-center active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Geofence banner — positive when presence is confirmed, blocking otherwise */}
          <div
            className={`mb-4 rounded-2xl p-3.5 flex items-start gap-2.5 ${
              presenceActive ? 'bg-rd-available-container' : 'bg-rd-out-container'
            }`}
          >
            <span
              aria-hidden="true"
              className={`material-symbols-outlined text-[20px] shrink-0 ${presenceActive ? 'text-rd-on-available-container' : 'text-rd-on-out-container'}`}
            >
              {presenceActive ? 'my_location' : 'location_off'}
            </span>
            <p className={`flex-1 text-caption font-semibold ${presenceActive ? 'text-rd-on-available-container' : 'text-rd-on-out-container'}`}>
              {presenceActive
                ? "You're at this station · reporting unlocked"
                : 'Reports unlock within 150 m of the station so every status comes from someone actually there.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 4 full-width radio rows */}
            <div className="flex flex-col gap-3.5">
              {statusOptions.map((opt) => {
                const on = selectedStatus === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedStatus(opt.key)}
                    role="radio"
                    aria-checked={on}
                    className={`w-full min-h-[76px] px-[18px] rounded-[20px] flex items-center gap-3 transition-all active:scale-[0.98] ${
                      on ? 'bg-white ring-[2.5px] ring-rd-ink' : 'bg-[#FAFBFA] ring-1 ring-[#E3E6E4]'
                    }`}
                  >
                    <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white ${opt.solid}`}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[22px] material-symbols-fill">{opt.icon}</span>
                    </span>
                    <span className="flex-1 text-left min-w-0">
                      <span className="block font-geist text-[1.125rem] font-bold text-rd-ink truncate">{opt.title}</span>
                      <span className="block text-[0.8125rem] text-rd-text-tertiary truncate">{opt.meaning}</span>
                    </span>
                    <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-rd-ink shrink-0" style={{ fontVariationSettings: on ? "'FILL' 1" : "'FILL' 0" }}>
                      {on ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional details — collapsed by default (handoff: "happy path = 2 taps") */}
            {!showMoreDetails ? (
              <button
                type="button"
                onClick={() => setShowMoreDetails(true)}
                className="w-full bg-white ring-1 ring-[#E3E6E4] rounded-[20px] px-[18px] py-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary shrink-0">add_a_photo</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-geist text-[0.9375rem] font-semibold text-rd-ink">Add wait time, live photo or note</span>
                  <span className="block text-[0.75rem] text-rd-text-tertiary">Optional · verified photos earn +15 pts</span>
                </span>
                <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-rd-text-tertiary shrink-0">expand_more</span>
              </button>
            ) : (
              <div className="bg-surface-container rounded-2xl p-3.5 flex flex-col gap-3.5">
                <div>
                  <p className="text-[0.75rem] font-bold text-outline uppercase tracking-wider">Wait time (optional)</p>
                  <div className="flex gap-1.5 mt-2">
                    {[
                      { label: '0–5m', v: 5 },
                      { label: '5–15m', v: 15 },
                      { label: '15–30m', v: 30 },
                      { label: '30m+', v: 45 },
                    ].map((chip) => (
                      <button
                        key={chip.v}
                        type="button"
                        onClick={() => setWaitTime(chip.v)}
                        className={`rounded-lg px-3 py-1.5 text-micro font-semibold transition-colors ${
                          waitTime === chip.v ? 'bg-rd-ink text-white' : 'bg-surface-container-high text-slate-500'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  {photoError && (
                    <div role="alert" className="mb-2 p-2.5 bg-status-red-container rounded-xl text-rose-700 text-micro font-medium flex items-start gap-2">
                      <span aria-hidden="true" className="material-symbols-outlined text-[16px] shrink-0 text-status-red">gpp_bad</span>
                      <span>{photoError}</span>
                    </div>
                  )}
                  {attachedPhoto ? (
                    <div className="relative rounded-xl overflow-hidden bg-black/10">
                      <img src={attachedPhoto} alt="Verified meter snapshot" className="w-full h-32 object-cover" />
                      <div className="absolute bottom-2 left-2 bg-slate-900/85 text-white text-[0.75rem] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-status-green">verified</span>
                        Live camera verified
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedPhoto(null);
                          setPhotoError(null);
                        }}
                        aria-label="Delete attached photo"
                        className="absolute top-2 right-2 w-9 h-9 bg-black/70 text-white rounded-full flex items-center justify-center"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowLiveCamera(true)}
                      className="w-full flex items-center gap-2 bg-surface-container-high rounded-xl p-2.5 text-left active:scale-[0.99] transition-transform"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-slate-700">photo_camera</span>
                      <span className="text-caption font-semibold flex-1">Add live photo</span>
                      <span className="text-[0.75rem] text-outline">Gallery blocked</span>
                    </button>
                  )}
                </div>

                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a note (optional)"
                  className="w-full bg-surface-container-high rounded-xl px-3 py-2.5 text-caption text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}

            {formError && (
              <div role="alert" className="bg-status-red-container rounded-2xl p-3 text-rose-700 text-micro font-semibold flex items-start gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px] shrink-0 text-status-red">error</span>
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!presenceActive || isSubmitting}
              className="w-full h-[58px] flex items-center justify-center gap-2 bg-primary text-white rounded-full font-geist font-bold text-body active:scale-[0.98] transition-all disabled:bg-[#B9BCC2] disabled:opacity-100"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting…</span>
                </div>
              ) : (
                <>
                  <span>Submit report</span>
                  <span className="text-[0.75rem] font-bold bg-white/20 rounded-full px-2 py-0.5">+10 pts</span>
                </>
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
