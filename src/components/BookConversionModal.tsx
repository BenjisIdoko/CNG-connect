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
  const [tankSize, setTankSize] = useState('15kg / 75L steel · sedans');
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
              <h3 className="text-[1.25rem] font-bold text-on-surface">Booked</h3>
              <p className="text-micro text-on-surface-variant font-normal mt-1">{center.name}</p>
            </div>

            <div className="bg-surface-container rounded-2xl p-4 text-left space-y-2 text-micro">
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Reference</span>
                <span className="font-bold text-primary">{bookingSuccessRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Code</span>
                <span className="font-bold text-on-surface">{center.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Date</span>
                <span className="font-bold text-on-surface">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Kit</span>
                <span className="font-bold text-on-surface truncate max-w-[200px]">{tankSize}</span>
              </div>
            </div>

            <div className="bg-surface rounded-2xl p-3 text-primary text-micro font-semibold flex items-center gap-2">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">stars</span>
              <span>+100 pts</span>
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
              className="w-full py-3.5 bg-primary text-on-primary font-bold text-body rounded-full shadow-md hover:opacity-95 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            {/* Selected Center Summary Card */}
            <div className="bg-surface-container rounded-2xl p-3.5 mb-4 space-y-1">
              <p className="font-bold text-body text-on-surface leading-snug">
                {center.name}
              </p>
              <p className="text-micro font-normal text-on-surface-variant truncate">
                {center.address} · {center.code}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-micro">
              <div>
                <label htmlFor="book-vehicle-make-year" className="block font-semibold text-on-surface-variant mb-1">
                  Vehicle Make &amp; Year
                </label>
                <input id="book-vehicle-make-year"
                  type="text"
                  required
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  placeholder="e.g. 2018 Toyota Camry, 2014 Honda Accord"
                  className="w-full bg-surface-container/90 rounded-2xl px-4 py-2.5 outline-none font-medium text-on-surface focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label htmlFor="book-cng-kit-tank-capacity" className="block font-semibold text-on-surface-variant mb-1">
                  CNG Kit Tank Capacity
                </label>
                <select id="book-cng-kit-tank-capacity" aria-label="CNG Kit Tank Capacity"
                  value={tankSize}
                  onChange={(e) => setTankSize(e.target.value)}
                  className="w-full bg-surface-container/90 rounded-2xl px-4 py-2.5 outline-none font-medium text-on-surface focus:ring-2 focus:ring-primary/30"
                >
                  <option value="15kg / 75L steel · sedans">15kg / 75L steel · sedans</option>
                  <option value="12kg / 60L compact · hatchbacks">12kg / 60L compact · hatchbacks</option>
                  <option value="Composite Type-3 · lightweight">Composite Type-3 · lightweight</option>
                  <option value="Dual 15kg · buses and vans">Dual 15kg · buses and vans</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="book-preferred-date" className="block font-semibold text-on-surface-variant mb-1">
                    Preferred Date
                  </label>
                  <input id="book-preferred-date"
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-surface-container/90 rounded-2xl px-3.5 py-2.5 outline-none font-medium text-on-surface focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label htmlFor="book-phone-number" className="block font-semibold text-on-surface-variant mb-1">
                    Phone Number
                  </label>
                  <input id="book-phone-number"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-surface-container/90 rounded-2xl px-3 py-2.5 outline-none font-medium text-on-surface focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="book-additional-notes-optional" className="block font-semibold text-on-surface-variant mb-1">
                  Notes (optional)
                </label>
                <textarea id="book-additional-notes-optional"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything we should know"
                  className="w-full bg-surface-container/90 rounded-2xl px-4 py-2 outline-none font-normal text-on-surface focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-primary text-on-primary font-bold text-body rounded-full shadow-lg hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Booking…</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">verified</span>
                      Confirm booking
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
