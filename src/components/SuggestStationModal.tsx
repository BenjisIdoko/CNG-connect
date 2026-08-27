import React, { useState } from 'react';
import { Modal } from './common/Modal';
import { StationSuggestion } from '../types';

interface SuggestStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuggestStation: (suggestion: Omit<StationSuggestion, 'id' | 'createdAt' | 'status'>) => void;
}

export const SuggestStationModal: React.FC<SuggestStationModalProps> = ({
  isOpen,
  onClose,
  onSuggestStation,
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [stationType, setStationType] = useState<'cng' | 'ev_charging'>('ev_charging');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Lagos');
  const [operator, setOperator] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !city.trim()) {
      setFormError('Please fill out the station name, address, and city.');
      return;
    }
    setFormError(null);

    onSuggestStation({
      name: name.trim(),
      address: address.trim(),
      stationType,
      city: city.trim(),
      state: state.trim(),
      operator: operator.trim() || undefined,
      notes: notes.trim() || undefined,
      photo,
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setName('');
      setAddress('');
      setCity('');
      setOperator('');
      setNotes('');
      setPhoto(undefined);
      onClose();
    }, 1800);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Suggest a New Station">
      <div className="p-4 sm:p-6 bg-surface max-h-[85vh] overflow-y-auto">
        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[36px]">verified</span>
            </div>
            <h3 className="text-[20px] font-extrabold text-on-surface">Submission Received!</h3>
            <p className="text-body font-medium text-outline max-w-sm">
              Thank you for contributing! Your suggested {stationType === 'ev_charging' ? 'EV charging point' : 'CNG station'} has been submitted for admin verification.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-caption font-medium text-outline">
              Help build Nigeria's clean energy mobility directory. Submit a new station or charger for community review.
            </p>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-caption font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{formError}</span>
              </div>
            )}

            {/* Station Type Segmented Toggle */}
            <div>
              <label className="block text-caption font-bold text-on-surface mb-1.5">
                Station Type *
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-high rounded-2xl border border-outline-variant">
                <button
                  type="button"
                  onClick={() => setStationType('cng')}
                  className={`py-2.5 px-3 rounded-xl font-extrabold text-caption flex items-center justify-center gap-2 transition-all ${
                    stationType === 'cng'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">local_gas_station</span>
                  <span>CNG Station</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStationType('ev_charging')}
                  className={`py-2.5 px-3 rounded-xl font-extrabold text-caption flex items-center justify-center gap-2 transition-all ${
                    stationType === 'ev_charging'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">ev_charger</span>
                  <span>⚡ EV Charger</span>
                </button>
              </div>
            </div>

            {/* Station Name */}
            <div>
              <label className="block text-caption font-bold text-on-surface mb-1">
                Station Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={stationType === 'ev_charging' ? "e.g., Qoray EV Hub - Victoria Island" : "e.g., NIPCO CNG Station - Ikeja"}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container border border-outline-variant text-body font-medium text-on-surface outline-none focus:border-primary"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-caption font-bold text-on-surface mb-1">
                Street Address / Landmark *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., Adeola Odeku St, opposite Eko Hotel, Lagos"
                className="w-full px-4 py-3 rounded-2xl bg-surface-container border border-outline-variant text-body font-medium text-on-surface outline-none focus:border-primary"
              />
            </div>

            {/* City & State Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-caption font-bold text-on-surface mb-1">
                  City / Area *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Victoria Island"
                  className="w-full px-4 py-3 rounded-2xl bg-surface-container border border-outline-variant text-body font-medium text-on-surface outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-caption font-bold text-on-surface mb-1">
                  State *
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-surface-container border border-outline-variant text-body font-medium text-on-surface outline-none focus:border-primary"
                >
                  <option value="Lagos">Lagos</option>
                  <option value="FCT Abuja">FCT Abuja</option>
                  <option value="Ogun">Ogun</option>
                  <option value="Oyo">Oyo</option>
                  <option value="Edo">Edo</option>
                  <option value="Delta">Delta</option>
                  <option value="Rivers">Rivers</option>
                  <option value="Kaduna">Kaduna</option>
                  <option value="Kano">Kano</option>
                  <option value="Enugu">Enugu</option>
                </select>
              </div>
            </div>

            {/* Operator / Network Name */}
            <div>
              <label className="block text-caption font-bold text-on-surface mb-1">
                Operator / Network Name (Optional)
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder={stationType === 'ev_charging' ? "e.g., Qoray Mobility, SAGLEV, NNPC" : "e.g., NIPCO, Bovas, NNPC Retail"}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container border border-outline-variant text-body font-medium text-on-surface outline-none focus:border-primary"
              />
            </div>

            {/* Photo Attachment (Optional) */}
            <div>
              <label className="block text-caption font-bold text-on-surface mb-1">
                Station Photo (Optional)
              </label>
              {photo ? (
                <div className="relative rounded-2xl overflow-hidden max-h-40 border-2 border-primary">
                  <img src={photo} alt="Station preview" className="w-full h-36 object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhoto(undefined)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ) : (
                <label className="w-full p-4 border-2 border-dashed border-outline-variant hover:border-primary rounded-2xl flex items-center justify-center gap-2 cursor-pointer text-caption font-bold text-primary bg-surface-container-lowest transition-colors">
                  <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
                  <span>Upload Station / Charger Photo</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-caption font-bold text-on-surface mb-1">
                Additional Notes / Charger Specs (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={stationType === 'ev_charging' ? "e.g., 2x 120kW CCS2 Fast Chargers located inside hotel basement" : "e.g., Station has high pressure dispensers near gate 2"}
                className="w-full px-4 py-3 rounded-2xl bg-surface-container border border-outline-variant text-body font-medium text-on-surface outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-full text-caption font-extrabold text-outline hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 rounded-full bg-primary text-on-primary font-extrabold text-caption shadow-md active:scale-95 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>Submit for Verification</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
