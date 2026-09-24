import React, { useState } from 'react';
import { ConversionCenter, UserProfile } from '../types';
import { Modal } from './common/Modal';

interface BookConversionModalProps {
  center: ConversionCenter;
  user?: UserProfile;
  onClose: () => void;
  onSuccess: (appointmentInfo: { centerName: string; preferredDate: string; bookingRef: string }) => void;
}

export const BookConversionModal: React.FC<BookConversionModalProps> = ({
  center,
  user,
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
    <Modal isOpen={true} onClose={onClose} title="Book CNG Kit Conversion" className="max-h-[90vh] overflow-y-auto">
      {bookingSuccessRef ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-container text-primary flex items-center justify-center mx-auto">
              <span aria-hidden="true" className="material-symbols-outlined text-[36px]">verified</span>
            </div>

            <div>
              <span className="bg-surface-container text-primary text-[0.75rem] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                Pi-CNG Booking Confirmed
              </span>
              <h3 className="text-[1.25rem] font-bold text-on-surface mt-2">
                Conversion Appointment Booked!
              </h3>
              <p className="text-[0.875rem] text-on-surface-variant font-normal mt-1">
                Your kit inspection slot at <strong className="text-on-surface font-semibold">{center.name}</strong> is reserved.
              </p>
            </div>

            <div className="bg-surface-container rounded-2xl p-4 text-left space-y-2 text-[0.875rem]">
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Booking Reference:</span>
                <span className="font-bold text-primary">{bookingSuccessRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Center Code:</span>
                <span className="font-bold text-on-surface">{center.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Date:</span>
                <span className="font-bold text-on-surface">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Kit Spec:</span>
                <span className="font-bold text-on-surface truncate max-w-[200px]">{tankSize}</span>
              </div>
            </div>

            <div className="bg-surface rounded-2xl p-3 text-primary text-[0.8125rem] font-semibold flex items-center gap-2">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">stars</span>
              <span>+100 Driver Reward Points added to your profile!</span>
            </div>

            <button
              onClick={() => {
                onSuccess({
                  centerName: center.name,
                  preferredDate: selectedDate,
                  bookingRef: bookingSuccessRef || '',
                });
                onClose();
              }}
              className="w-full py-3.5 bg-primary text-on-primary font-bold text-[0.9375rem] rounded-full shadow-md hover:opacity-95 transition-all"
            >
              Done & Return
            </button>
          </div>
        ) : (
          <div>
            <span className="inline-block text-[0.75rem] font-semibold text-primary bg-primary-container px-2.5 py-0.5 rounded-full uppercase mb-3">
              Accredited Workshop
            </span>

            {/* Selected Center Summary Card */}
            <div className="bg-surface-container rounded-2xl p-3.5 mb-4 space-y-1">
              <span className="text-[0.75rem] font-semibold text-primary uppercase tracking-wider block">
                Selected Workshop ({center.code})
              </span>
              <p className="font-bold text-[0.9375rem] text-on-surface leading-snug">
                {center.name}
              </p>
              <p className="text-[0.8125rem] font-normal text-on-surface-variant truncate">
                {center.address}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-[0.875rem]">
              <div>
                <label className="block font-semibold text-on-surface-variant mb-1">
                  Vehicle Make &amp; Year
                </label>
                <input
                  type="text"
                  required
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  placeholder="e.g. 2018 Toyota Camry, 2014 Honda Accord"
                  className="w-full bg-surface-container/90 rounded-2xl px-4 py-2.5 outline-none font-medium text-on-surface focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface-variant mb-1">
                  CNG Kit Tank Capacity
                </label>
                <select aria-label="CNG Kit Tank Capacity"
                  value={tankSize}
                  onChange={(e) => setTankSize(e.target.value)}
                  className="w-full bg-surface-container/90 rounded-2xl px-4 py-2.5 outline-none font-medium text-on-surface focus:ring-2 focus:ring-primary/30"
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
                  <label className="block font-semibold text-on-surface-variant mb-1">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-surface-container/90 rounded-2xl px-3.5 py-2.5 outline-none font-medium text-on-surface focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-on-surface-variant mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-surface-container/90 rounded-2xl px-3 py-2.5 outline-none font-medium text-on-surface focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-on-surface-variant mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mention any existing vehicle issues or special instructions..."
                  className="w-full bg-surface-container/90 rounded-2xl px-4 py-2 outline-none font-normal text-on-surface focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-primary text-on-primary font-bold text-[0.9375rem] rounded-full shadow-lg hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Confirming Slot...</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">verified</span>
                      Confirm Conversion Appointment (+100 PTS)
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
    </Modal>
  );
};
