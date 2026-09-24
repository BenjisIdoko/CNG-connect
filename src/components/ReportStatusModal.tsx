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

  return (
    <Modal isOpen={true} onClose={onClose} title="Report Status" className="bg-surface border-surface-container-highest max-h-[90vh] overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl z-10 max-h-[90vh] overflow-y-auto pb-safe">
        <div className="px-5 pb-6 pt-2">
          <div className="flex items-center gap-1 mb-4">
            <div className="min-w-0 flex-1">
              <p className="text-caption text-outline truncate flex items-center gap-1.5">
                {station.name}
                <button
                  type="button"
                  onClick={() => setShowInfoSheet(true)}
                  aria-label="Station Group Policy Info"
                  className="text-outline/70 hover:text-outline"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[15px]">info</span>
                </button>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 4 full-width single-tap status buttons */}
            <div className="flex flex-col gap-2.5">
              {(() => {
                const isEv = station.stationType === 'ev_charging';
                const options: {
                  key: StationStatus;
                  label: string;
                  icon: string;
                  dot: string;
                  solid: string;
                  shadow: string;
                }[] = [
                  { key: 'full', label: isEv ? 'Available' : 'Available — full stock', icon: 'check', dot: 'bg-status-green', solid: 'bg-status-green', shadow: 'shadow-[0_8px_20px_rgba(49,154,63,0.35)]' },
                  { key: 'queue', label: isEv ? 'Busy' : 'Queuing / busy', icon: 'schedule', dot: 'bg-status-amber', solid: 'bg-status-amber', shadow: 'shadow-[0_8px_20px_rgba(245,166,35,0.35)]' },
                  { key: 'low', label: isEv ? 'All ports occupied' : 'Low pressure', icon: 'warning', dot: 'bg-status-orange', solid: 'bg-status-orange', shadow: 'shadow-[0_8px_20px_rgba(248,91,35,0.35)]' },
                  { key: 'out', label: isEv ? 'Out of service' : 'Out of service', icon: 'close', dot: 'bg-status-red', solid: 'bg-status-red', shadow: 'shadow-[0_8px_20px_rgba(229,72,77,0.35)]' },
                ];
                return options.map((opt) => {
                  const on = selectedStatus === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSelectedStatus(opt.key)}
                      aria-pressed={on}
                      className={`w-full min-h-[58px] px-4 rounded-[18px] flex items-center gap-3 transition-all active:scale-[0.98] ${
                        on ? `${opt.solid} text-white ${opt.shadow}` : 'bg-surface-container text-slate-900 shadow-[0_2px_8px_rgba(14,20,32,0.05)]'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white ${
                          on ? 'bg-white/20' : opt.dot
                        }`}
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px] material-symbols-fill">{opt.icon}</span>
                      </span>
                      <span className={`flex-1 text-left text-body ${on ? 'font-extrabold' : 'font-semibold'}`}>{opt.label}</span>
                      {on && <span aria-hidden="true" className="material-symbols-outlined text-[20px]">check</span>}
                    </button>
                  );
                });
              })()}
            </div>

            {/* Optional details */}
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
                        waitTime === chip.v ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'
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
                    className="w-full flex items-center gap-2 bg-white rounded-xl p-2.5 text-left active:scale-[0.99] transition-transform"
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
                className="w-full bg-white rounded-xl px-3 py-2.5 text-caption text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {!presenceActive && (
              <div className="bg-status-red-container rounded-2xl p-3.5 text-rose-900 flex items-start gap-2.5">
                <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-status-red shrink-0">location_off</span>
                <div className="flex-1 text-caption">
                  <strong className="block font-extrabold mb-0.5">You need to be at the station</strong>
                  <span>Reports need active GPS presence within the station&apos;s geofence.</span>
                </div>
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
              className="w-full py-4 flex items-center justify-center bg-primary text-white rounded-full font-bold text-body active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting…</span>
                </div>
              ) : (
                <span>Submit Report</span>
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
