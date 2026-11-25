import React, { useEffect, useRef, useState } from 'react';
import { GasStation, StationStatus, DriverReport, UserProfile } from '../types';
import { verifyImageMetadata, registerSharedImageHash } from '../utils/imageMetadataVerifier';
import { LiveCameraCaptureModal } from './LiveCameraCaptureModal';
import { checkReportPosition, type PingPosition } from '../utils/geofencePresence';
import { reportPhotoHint, reportProofProblem } from '../utils/reportProof';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';
import { Modal } from './common/Modal';
import { isPlausiblePrice, PRICE_MIN_NAIRA, PRICE_MAX_NAIRA } from '../utils/stationPrice';

interface ReportStatusModalProps {
  station: GasStation;
  user?: UserProfile;
  onClose: () => void;
  onSubmitReport: (newReport: DriverReport, updatedStationStatus: StationStatus) => void;
  /** The driver's latest GPS fix as the app last saw it; drives the banner and the buttons. */
  getPosition: () => PingPosition | null;
  /** A fresh GPS fix, asked for when taking the photo and when submitting. Null when none could be had. */
  getFreshPosition: () => Promise<PingPosition | null>;
  /** The status to start on, when the driver tapped one in a prompt. */
  initialStatus?: StationStatus;
}

export const ReportStatusModal: React.FC<ReportStatusModalProps> = ({
  station,
  user,
  onClose,
  onSubmitReport,
  getPosition,
  getFreshPosition,
  initialStatus,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<StationStatus>(initialStatus ?? 'full');
  const [waitTime, setWaitTime] = useState<number>(15);
  const [priceText, setPriceText] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);
  // Where the phone was when the photo was taken; it travels with the report as proof.
  const [photoPosition, setPhotoPosition] = useState<PingPosition | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Where the driver is right now, for the banner and the buttons: refreshed every few seconds.
  const getPositionRef = useRef(getPosition);
  getPositionRef.current = getPosition;
  const [position, setPosition] = useState<PingPosition | null>(() => getPosition());
  useEffect(() => {
    const timer = setInterval(() => setPosition(getPositionRef.current()), 3000);
    return () => clearInterval(timer);
  }, []);
  const positionCheck = checkReportPosition(position, station);
  const canReport = positionCheck.allowed;

  // Clear pending submit timer if the modal unmounts mid-submit
  useEffect(() => {
    return () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    };
  }, []);

  // The photo is proof for one status, so choosing another means taking a new one.
  const chooseStatus = (status: StationStatus) => {
    if (status === selectedStatus) return;
    setSelectedStatus(status);
    if (attachedPhoto) {
      setAttachedPhoto(null);
      setPhotoPosition(null);
      setPhotoError('Take a new photo for this status.');
    }
  };

  // Ask for a fresh fix before opening the camera, so a driver who has already left is told so.
  const openCamera = async () => {
    setPhotoError(null);
    const check = checkReportPosition(await getFreshPosition(), station);
    if (!check.allowed) {
      setPhotoError(check.reason);
      return;
    }
    setShowLiveCamera(true);
  };

  const handleCapturedPhoto = async (dataUrl: string) => {
    setShowLiveCamera(false);
    // The position is taken again at the moment the photo comes back, and saved with it.
    const fix = await getFreshPosition();
    const check = checkReportPosition(fix, station);
    if (!check.allowed || !fix) {
      setPhotoError(check.allowed ? 'Turn on location to report.' : check.reason);
      return;
    }
    // Freshness/duplicate CHECK at capture time (registration happens only when the report is submitted).
    const verification = verifyImageMetadata(undefined, dataUrl);
    if (!verification.isValid) {
      setPhotoError(verification.reason || 'Photo rejected by anti-misinformation check.');
      return;
    }
    setAttachedPhoto(dataUrl);
    setPhotoPosition(fix);
    setPhotoError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const fail = (message: string) => {
      setFormError(message);
      setIsSubmitting(false);
    };

    // The driver must still be at the station when they press Submit, not only when the photo was taken.
    const check = checkReportPosition(await getFreshPosition(), station);
    if (!check.allowed) return fail(check.reason);

    const proofProblem = reportProofProblem(
      { photo: attachedPhoto ?? undefined, photoLat: photoPosition?.lat, photoLng: photoPosition?.lng },
      station,
    );
    if (proofProblem || !attachedPhoto || !photoPosition) {
      return fail(proofProblem || 'Take a live photo at the station to post this report.');
    }

    // The price is optional; if one is typed it has to be a plausible ₦/kg figure.
    const typedPrice = priceText.trim() === '' ? null : Number(priceText.replace(/,/g, ''));
    if (typedPrice != null && !isPlausiblePrice(typedPrice)) {
      setShowMoreDetails(true);
      return fail(`Price per kg should be between ₦${PRICE_MIN_NAIRA} and ₦${PRICE_MAX_NAIRA.toLocaleString('en-NG')}, or leave it blank`);
    }
    setFormError(null);

    const isEv = station.stationType === 'ev_charging';

    const statusLabels: Record<StationStatus, string> = isEv
      ? {
          full: 'Reported Available',
          queue: 'Reported Busy',
          out: 'Reported Out of Service',
          unknown: 'No recent reports',
        }
      : {
          full: 'Reported Full stock',
          queue: 'Reported Queuing',
          out: 'Reported Out of gas',
          unknown: 'No recent reports',
        };

    // Register the photo hash only NOW (at publish time), not at capture time.
    registerSharedImageHash(attachedPhoto);

    const newReport: DriverReport = {
      id: `report-${Date.now()}`,
      author: user?.name || 'Anonymous Driver',
      authorAvatar: user?.avatar || '',
      verified: true,
      isPhotoVerified: true,
      timestamp: new Date().toISOString(),
      status: selectedStatus,
      statusLabel: statusLabels[selectedStatus],
      waitMinutes: waitTime,
      cngPriceNaira: !isEv && typedPrice != null ? typedPrice : undefined,
      comment: comment.trim() || undefined,
      likes: 1,
      userVoted: 'up',
      photo: attachedPhoto,
      photoLat: photoPosition.lat,
      photoLng: photoPosition.lng,
      photoAccuracyM: photoPosition.accuracy,
    };

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
        { key: 'out', title: 'Out of service', meaning: 'Not charging right now', icon: 'block', solid: 'bg-rd-out', container: 'bg-rd-out-container' },
      ]
    : [
        { key: 'full', title: 'Available', meaning: 'Full stock, no wait', icon: 'check_circle', solid: 'bg-rd-available', container: 'bg-rd-available-container' },
        { key: 'queue', title: 'Queuing', meaning: 'Gas is flowing, expect a wait', icon: 'schedule', solid: 'bg-rd-queuing', container: 'bg-rd-queuing-container' },
        { key: 'out', title: 'Out of gas', meaning: 'Not dispensing right now', icon: 'block', solid: 'bg-rd-out', container: 'bg-rd-out-container' },
      ];

  return (
    <Modal isOpen={true} onClose={onClose} title={`Report status for ${station.name}`} bare className="bg-rd-surface max-h-[90vh] overflow-y-auto">
      <div className="relative w-full max-w-lg bg-rd-surface rounded-t-[28px] sm:rounded-3xl z-10 max-h-[90vh] overflow-y-auto pb-safe">
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
              <h1 className="font-geist text-[1.625rem] font-bold text-rd-fg tracking-tight leading-tight mt-0.5">
                {isEv ? "How's the charger now?" : "How's the pump now?"}
              </h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-10 h-10 rounded-full bg-surface-container text-rd-fg flex items-center justify-center active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Geofence banner — positive when the driver is at the station, blocking otherwise */}
          <div
            className={`mb-4 rounded-2xl p-3.5 flex items-start gap-2.5 ${
              canReport ? 'bg-rd-available-container' : 'bg-rd-out-container'
            }`}
          >
            <span
              aria-hidden="true"
              className={`material-symbols-outlined text-[20px] shrink-0 ${canReport ? 'text-rd-on-available-container' : 'text-rd-on-out-container'}`}
            >
              {canReport ? 'my_location' : 'location_off'}
            </span>
            <p className={`flex-1 text-caption font-semibold ${canReport ? 'text-rd-on-available-container' : 'text-rd-on-out-container'}`}>
              {positionCheck.allowed ? "You're at this station · reporting unlocked" : positionCheck.reason}
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
                    onClick={() => chooseStatus(opt.key)}
                    role="radio"
                    aria-checked={on}
                    className={`w-full min-h-[76px] px-[18px] rounded-[20px] flex items-center gap-3 transition-all active:scale-[0.98] ${
                      on ? 'bg-rd-surface ring-[2.5px] ring-rd-fg' : 'bg-rd-bg ring-1 ring-rd-divider'
                    }`}
                  >
                    <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white ${opt.solid}`}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[22px] material-symbols-fill">{opt.icon}</span>
                    </span>
                    <span className="flex-1 text-left min-w-0">
                      <span className="block font-geist text-[1.125rem] font-bold text-rd-fg truncate">{opt.title}</span>
                      <span className="block text-[0.8125rem] text-rd-text-tertiary truncate">{opt.meaning}</span>
                    </span>
                    <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-rd-fg shrink-0" style={{ fontVariationSettings: on ? "'FILL' 1" : "'FILL' 0" }}>
                      {on ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Photo proof — required for every status */}
            <div className="bg-surface-container rounded-2xl p-3.5 flex flex-col gap-2.5">
              <div>
                <p className="text-[0.75rem] font-bold text-outline uppercase tracking-wider">Photo required</p>
                <p className="text-caption font-semibold text-rd-fg mt-0.5">{reportPhotoHint(selectedStatus, isEv)}</p>
              </div>
              {photoError && (
                <div role="alert" className="p-2.5 bg-status-red-container rounded-xl text-rose-700 text-micro font-medium flex items-start gap-2">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px] shrink-0 text-status-red">gpp_bad</span>
                  <span>{photoError}</span>
                </div>
              )}
              {attachedPhoto ? (
                <div className="relative rounded-xl overflow-hidden bg-black/10">
                  <img src={attachedPhoto} alt="Live photo taken at the station" className="w-full h-32 object-cover" />
                  <div className="absolute bottom-2 left-2 bg-slate-900/85 text-white text-[0.75rem] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-status-green">verified</span>
                    Live photo at the station
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedPhoto(null);
                      setPhotoPosition(null);
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
                  onClick={openCamera}
                  disabled={!canReport}
                  className="w-full flex items-center gap-2 bg-surface-container-high rounded-xl p-3 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-slate-700">photo_camera</span>
                  <span className="text-caption font-semibold flex-1">Take photo</span>
                  <span className="text-[0.75rem] text-outline">Live camera only</span>
                </button>
              )}
            </div>

            {/* Optional details — collapsed by default (handoff: "happy path = 2 taps") */}
            {!showMoreDetails ? (
              <button
                type="button"
                onClick={() => setShowMoreDetails(true)}
                className="w-full bg-rd-surface ring-1 ring-rd-divider rounded-[20px] px-[18px] py-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary shrink-0">add_a_photo</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-geist text-[0.9375rem] font-semibold text-rd-fg">
                    {isEv ? 'Add wait time or a note' : 'Add price, wait time or a note'}
                  </span>
                  <span className="block text-[0.75rem] text-rd-text-tertiary">Optional</span>
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
                          waitTime === chip.v ? 'bg-rd-selected text-rd-on-selected' : 'bg-surface-container-high text-slate-500'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!isEv && (
                  <div>
                    <label htmlFor="report-cng-price" className="text-[0.75rem] font-bold text-outline uppercase tracking-wider">
                      CNG price per kg (optional)
                    </label>
                    <div className="mt-2 flex items-center gap-2 bg-surface-container-high rounded-xl px-3 min-h-11">
                      <span aria-hidden="true" className="font-geist font-bold text-rd-fg">₦</span>
                      <input
                        id="report-cng-price"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="e.g. 230"
                        value={priceText}
                        onChange={(e) => setPriceText(e.target.value.replace(/[^0-9.,]/g, ''))}
                        className="flex-1 min-w-0 bg-transparent text-body font-semibold text-rd-fg placeholder:text-outline placeholder:font-normal focus:outline-none"
                      />
                      <span aria-hidden="true" className="text-caption text-outline">/kg</span>
                    </div>
                  </div>
                )}

                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  aria-label="Note (optional)"
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
              disabled={!canReport || !attachedPhoto || isSubmitting}
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
                  <span className="text-micro font-bold bg-white/20 rounded-full px-2 py-0.5">+100 pts</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {showLiveCamera && (
        <LiveCameraCaptureModal
          title={`Live Photo of ${station.name}`}
          onCapture={handleCapturedPhoto}
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
