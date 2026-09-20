import React, { useState } from 'react';
import { Modal } from './common/Modal';

interface CngRoiCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConversions?: () => void;
}

export const CngRoiCalculatorModal: React.FC<CngRoiCalculatorModalProps> = ({
  isOpen,
  onClose,
  onOpenConversions,
}) => {
  // Inputs
  const [dailyKm, setDailyKm] = useState<number>(80);
  const [kmPerLiter, setKmPerLiter] = useState<number>(10);
  const [petrolPrice, setPetrolPrice] = useState<number>(1050);
  const [cngPrice, setCngPrice] = useState<number>(230);
  const [isCommercialGrant, setIsCommercialGrant] = useState<boolean>(true);
  const [customKitCost, setCustomKitCost] = useState<number>(750000);

  const effectiveKitCost = isCommercialGrant ? 0 : customKitCost;

  // Financial & Energy Calculations
  // 1 kg CNG ≈ 1.35 Liters of Petrol in energy equivalence
  const dailyPetrolLiters = dailyKm / (kmPerLiter || 1);
  const dailyCngKg = dailyPetrolLiters / 1.35;

  const dailyPetrolCost = dailyPetrolLiters * petrolPrice;
  const dailyCngCost = dailyCngKg * cngPrice;

  const dailySavings = Math.max(0, dailyPetrolCost - dailyCngCost);
  const monthlySavings = Math.round(dailySavings * 30);
  const annualSavings = Math.round(dailySavings * 365);

  const savingsPercent = dailyPetrolCost > 0 ? Math.round((dailySavings / dailyPetrolCost) * 100) : 0;

  const paybackMonths =
    effectiveKitCost === 0
      ? 'Free (grant)'
      : monthlySavings > 0
      ? Math.round(effectiveKitCost / monthlySavings) + ' months'
      : 'N/A';

  // CO2 Reduction (approx 2.31kg CO2 per liter of petrol replaced)
  const annualCo2SavedTons = ((dailyPetrolLiters * 365 * 2.31 * 0.25) / 1000).toFixed(1);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fuel Savings Calculator" bare className="max-w-lg">
      <div className="flex flex-col text-on-surface">
        <div className="bg-deep-teal text-white px-5 pt-5 pb-6">
          <div className="flex items-center justify-between">
            <span className="font-bold text-body">Fuel Savings Calculator</span>
            <button onClick={onClose} aria-label="Close" className="text-[#9FB8A3] p-1 -mr-1">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="text-center mt-5">
            <div className="text-[0.75rem] font-bold uppercase tracking-[0.06em] text-[#9FB8A3]">You&apos;d save</div>
            <div className="font-extrabold text-[2.75rem] leading-none tracking-tight mt-2">
              ₦{monthlySavings.toLocaleString()}
              <span className="text-[0.9375rem] font-semibold text-[#9FB8A3]">/mo</span>
            </div>
            <div className="text-caption text-[#9FB8A3] mt-2">{savingsPercent}% less than petrol</div>
          </div>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          <div>
            <div className="flex justify-between text-caption font-semibold">
              <span>Daily distance</span>
              <span className="text-primary">{dailyKm} km</span>
            </div>
            <input type="range" min={20} max={400} step={10} value={dailyKm}
              onChange={(e) => setDailyKm(Number(e.target.value))} className="w-full mt-2 accent-primary" />
          </div>
          <div>
            <div className="flex justify-between text-caption font-semibold">
              <span>Vehicle mileage</span>
              <span className="text-primary">{kmPerLiter} km/l</span>
            </div>
            <input type="range" min={4} max={20} step={1} value={kmPerLiter}
              onChange={(e) => setKmPerLiter(Number(e.target.value))} className="w-full mt-2 accent-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-micro font-semibold text-outline">Petrol (₦/L)</span>
              <input type="number" value={petrolPrice} onChange={(e) => setPetrolPrice(Number(e.target.value))}
                className="mt-1 w-full bg-surface rounded-xl px-3 py-2 text-caption font-bold outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
            <label className="block">
              <span className="text-micro font-semibold text-outline">CNG (₦/kg)</span>
              <input type="number" value={cngPrice} onChange={(e) => setCngPrice(Number(e.target.value))}
                className="mt-1 w-full bg-surface rounded-xl px-3 py-2 text-caption font-bold outline-none focus:ring-2 focus:ring-primary/30" />
            </label>
          </div>

          <div className="flex gap-1 bg-surface rounded-full p-1">
            {[
              { on: true, label: 'Government grant' },
              { on: false, label: 'Self-funded kit' },
            ].map((opt) => (
              <button key={String(opt.on)} type="button" onClick={() => setIsCommercialGrant(opt.on)}
                className={`flex-1 rounded-full py-2.5 text-caption font-semibold transition-colors ${
                  isCommercialGrant === opt.on ? 'bg-slate-900 text-white' : 'text-slate-500'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-surface-container rounded-2xl p-3">
              <div className="text-micro font-semibold text-outline">Payback</div>
              <div className="font-bold text-body mt-0.5">{paybackMonths}</div>
            </div>
            <div className="bg-surface-container rounded-2xl p-3">
              <div className="text-micro font-semibold text-outline">CO₂ avoided</div>
              <div className="font-bold text-body mt-0.5">{annualCo2SavedTons} t/yr</div>
            </div>
          </div>

          {onOpenConversions && (
            <button
              onClick={() => {
                onClose();
                onOpenConversions();
              }}
              className="w-full py-3.5 bg-primary text-white font-bold text-body rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              Find an accredited centre
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
