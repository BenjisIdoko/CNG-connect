import React, { useState } from 'react';
import { GasStation, StationStatus, DriverReport } from '../types';
import { ASSETS } from '../data/mockData';

interface ReportStatusModalProps {
  station: GasStation;
  onClose: () => void;
  onSubmitReport: (newReport: DriverReport, updatedStationStatus: StationStatus) => void;
}

export const ReportStatusModal: React.FC<ReportStatusModalProps> = ({
  station,
  onClose,
  onSubmitReport,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<StationStatus>('full');
  const [waitTime, setWaitTime] = useState<number>(15);
  const [comment, setComment] = useState<string>('');
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const statusLabels: Record<StationStatus, string> = {
      full: 'Reported Full stock',
      low: 'Reported Low pressure',
      queue: 'Reported Queuing',
      out: 'Reported Out of gas',
    };

    const newReport: DriverReport = {
      id: `report-${Date.now()}`,
      author: 'Tunde Adebayo',
      authorAvatar: ASSETS.userAvatar,
      verified: true,
      isPhotoVerified: Boolean(attachedPhoto),
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[20px] font-extrabold text-[#141d19] leading-snug">
              How's {station.name} right now?
            </h2>
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
                <span className="text-[14px] font-extrabold text-[#141d19]">
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
                <span className="text-[14px] font-extrabold text-[#141d19]">
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
                <span className="text-[14px] font-extrabold text-[#141d19]">
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
                <span className="text-[14px] font-extrabold text-[#141d19]">
                  Out of gas
                </span>
                {selectedStatus === 'out' && (
                  <div className="absolute top-3.5 right-3.5 w-3 h-3 bg-[#ba1a1a] rounded-full" />
                )}
              </button>
            </div>

            {/* Wait Time Stepper */}
            <div>
              <label className="block text-[13px] font-bold text-[#3a4a43] mb-1.5">
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

            {/* Photo of Pump Meter */}
            <div>
              <label className="block text-[13px] font-bold text-[#3a4a43] mb-1.5">
                Photo of Pump Meter (Optional)
              </label>
              {attachedPhoto ? (
                <div className="relative rounded-2xl overflow-hidden border border-[#006c50] max-h-40 bg-black/10">
                  <img
                    src={attachedPhoto}
                    alt="Uploaded meter"
                    className="w-full h-36 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setAttachedPhoto(null)}
                    className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ) : (
                <label className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#b9cbc1] rounded-2xl bg-[#f2fcf5] hover:bg-[#ecf6ef] transition-colors cursor-pointer group">
                  <span className="material-symbols-outlined text-[#6a7b72] mb-1 group-hover:text-[#006c50] transition-colors text-[28px]">
                    photo_camera
                  </span>
                  <span className="text-[13px] font-bold text-[#3a4a43] text-center leading-tight">
                    Add a photo of the pump meter
                    <br />
                    <span className="text-[11px] font-medium text-[#6a7b72]">
                      (Validates dispenser pressure & price)
                    </span>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Notes / Comment Input */}
            <div>
              <label className="block text-[13px] font-bold text-[#3a4a43] mb-1.5">
                Driver Note / Observation
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Pump 2 working fast, POS terminal active, line moving smoothly..."
                rows={2}
                className="w-full bg-[#e6f0e9] border border-[#dbe5de] rounded-2xl p-3 text-[14px] font-medium text-[#141d19] placeholder:text-[#6a7b72] focus:outline-none focus:ring-2 focus:ring-[#006c50]/30"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-13 flex items-center justify-center bg-[#006c50] hover:bg-[#004D40] text-white rounded-full font-extrabold text-[15px] shadow-md active:scale-[0.98] transition-all disabled:opacity-50 mt-1"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </div>
              ) : (
                'Submit report'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
