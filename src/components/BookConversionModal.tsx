import React, { useState } from 'react';
import { ConversionCenter } from '../types';

interface BookConversionModalProps {
  center: ConversionCenter;
  onClose: () => void;
  onSuccess: (bookingRef: string) => void;
}

export const BookConversionModal: React.FC<BookConversionModalProps> = ({
  center,
  onClose,
  onSuccess,
}) => {
  const [carModel, setCarModel] = useState('2018 Toyota Camry');
  const [tankSize, setTankSize] = useState('15kg / 75L Steel Cylinder (Recommended)');
  const [selectedDate, setSelectedDate] = useState('2026-08-25');
  const [phone, setPhone] = useState('+234 803 456 7890');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccessRef, setBookingSuccessRef] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const randomRef = `PICNG-${Math.floor(100000 + Math.random() * 900000)}`;
      setBookingSuccessRef(randomRef);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-fade-in border border-slate-200/80 max-h-[90vh] overflow-y-auto">
        {bookingSuccessRef ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#00c853]/15 text-[#00c853] flex items-center justify-center mx-auto border border-[#00c853]/30">
              <span className="material-symbols-outlined text-[36px]">verified</span>
            </div>

            <div>
              <span className="bg-emerald-100 text-[#006c50] text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                Pi-CNG Booking Confirmed
              </span>
              <h3 className="text-[20px] font-black text-slate-900 mt-2">
                Conversion Appointment Booked!
              </h3>
              <p className="text-[13px] text-slate-500 font-medium mt-1">
                Your kit inspection slot at <strong className="text-slate-900">{center.name}</strong> is reserved.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Booking Reference:</span>
                <span className="font-extrabold text-[#006c50]">{bookingSuccessRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Center Code:</span>
                <span className="font-extrabold text-slate-900">{center.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Date:</span>
                <span className="font-extrabold text-slate-900">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Kit Spec:</span>
                <span className="font-extrabold text-slate-900 truncate max-w-[200px]">{tankSize}</span>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 text-[#006c50] text-[12px] font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">stars</span>
              <span>+100 Driver Reward Points added to your profile!</span>
            </div>

            <button
              onClick={() => {
                onSuccess(bookingSuccessRef);
                onClose();
              }}
              className="w-full py-3.5 bg-[#004D40] text-white font-extrabold text-[14px] rounded-full shadow-md hover:bg-[#00382f] transition-all"
            >
              Done & Return
            </button>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-black text-[#006c50] bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase">
                  Accredited Workshop
                </span>
                <h3 className="font-black text-[18px] text-slate-900 mt-1">
                  Book CNG Kit Conversion
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Selected Center Summary Card */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 mb-4 space-y-1">
              <span className="text-[10.5px] font-black text-[#006c50] uppercase tracking-wider block">
                Selected Workshop ({center.code})
              </span>
              <p className="font-black text-[14px] text-slate-900 leading-snug">
                {center.name}
              </p>
              <p className="text-[12px] font-medium text-slate-500 truncate">
                {center.address}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-[13px]">
              <div>
                <label className="block font-extrabold text-slate-700 mb-1">
                  Vehicle Make &amp; Year
                </label>
                <input
                  type="text"
                  required
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  placeholder="e.g. 2018 Toyota Camry, 2014 Honda Accord"
                  className="w-full bg-slate-100/90 rounded-2xl px-4 py-2.5 outline-none font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block font-extrabold text-slate-700 mb-1">
                  CNG Kit Tank Capacity
                </label>
                <select
                  value={tankSize}
                  onChange={(e) => setTankSize(e.target.value)}
                  className="w-full bg-slate-100/90 rounded-2xl px-4 py-2.5 outline-none font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="15kg / 75L Steel Cylinder (Recommended)">
                    15kg / 75L Steel Cylinder (Recommended for Sedans)
                  </option>
                  <option value="12kg / 60L Compact Cylinder">
                    12kg / 60L Compact Cylinder (Hatchbacks)
                  </option>
                  <option value="Composite Type-3 Ultra Light Cylinder">
                    Composite Type-3 Ultra Light Cylinder (Premium)
                  </option>
                  <option value="Dual 15kg Tanks (Commercial Buses/Vans)">
                    Dual 15kg Tanks (Commercial Buses / Vans)
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-100/90 rounded-2xl px-3.5 py-2.5 outline-none font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div>
                  <label className="block font-extrabold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-100/90 rounded-2xl px-3 py-2.5 outline-none font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="block font-extrabold text-slate-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mention any existing vehicle issues or special instructions..."
                  className="w-full bg-slate-100/90 rounded-2xl px-4 py-2 outline-none font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-[#004D40] text-white font-extrabold text-[14px] rounded-full shadow-lg hover:bg-[#00382f] active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Confirming Slot...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      Confirm Conversion Appointment (+100 PTS)
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
