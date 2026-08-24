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
      ? '0 (Instant Grant)'
      : monthlySavings > 0
      ? (effectiveKitCost / monthlySavings).toFixed(1) + ' Months'
      : 'N/A';

  // CO2 Reduction (approx 2.31kg CO2 per liter of petrol replaced)
  const annualCo2SavedTons = ((dailyPetrolLiters * 365 * 2.31 * 0.25) / 1000).toFixed(1);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CNG Conversion ROI & Savings Calculator" className="max-w-lg">
      <div className="flex flex-col gap-4 text-on-surface font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-deep-teal via-primary to-emerald-900 rounded-2xl p-4 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="bg-status-green/20 border border-status-green/40 text-status-green text-[10.5px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Fuel Cost Savings Simulator
            </span>
            <span className="text-[11px] font-semibold text-emerald-100/90">
              Pi-CNG Standard Rate
            </span>
          </div>

          <div className="mt-2">
            <span className="text-[12px] text-emerald-100/80 font-medium">Estimated Monthly Savings</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-[32px] sm:text-[36px] font-extrabold text-white leading-none">
                ₦{monthlySavings.toLocaleString()}
              </span>
              <span className="text-[13px] font-bold text-status-green">/ month ({savingsPercent}% saved)</span>
            </div>
          </div>
        </div>

        {/* Interactive Sliders & Inputs */}
        <div className="bg-white rounded-2xl p-4 border border-surface-container-highest shadow-2xs flex flex-col gap-4">
          <h3 className="font-bold text-[14px] text-slate-900 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
            <span>Customize Your Driving Parameters</span>
          </h3>

          {/* Daily Distance Slider */}
          <div>
            <div className="flex justify-between items-center text-[12.5px] font-semibold text-slate-700 mb-1">
              <span>Daily Driving Distance</span>
              <span className="text-primary font-extrabold">{dailyKm} km / day</span>
            </div>
            <input
              type="range"
              min="20"
              max="300"
              step="5"
              value={dailyKm}
              onChange={(e) => setDailyKm(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-surface-container rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-1">
              <span>20 km (Short commute)</span>
              <span>150 km (Intercity)</span>
              <span>300 km (Taxi/Fleet)</span>
            </div>
          </div>

          {/* Fuel Efficiency */}
          <div>
            <div className="flex justify-between items-center text-[12.5px] font-semibold text-slate-700 mb-1">
              <span>Vehicle Mileage / Efficiency</span>
              <span className="text-primary font-extrabold">{kmPerLiter} km / liter</span>
            </div>
            <input
              type="range"
              min="6"
              max="18"
              step="1"
              value={kmPerLiter}
              onChange={(e) => setKmPerLiter(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-surface-container rounded-lg cursor-pointer"
            />
          </div>

          {/* Price Comparisons */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11.5px] font-bold text-slate-600 mb-1">Petrol Price (₦/Liter)</label>
              <input
                type="number"
                value={petrolPrice}
                onChange={(e) => setPetrolPrice(Number(e.target.value))}
                className="w-full bg-surface border border-surface-container-highest rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-slate-600 mb-1">CNG Price (₦/kg)</label>
              <input
                type="number"
                value={cngPrice}
                onChange={(e) => setCngPrice(Number(e.target.value))}
                className="w-full bg-surface border border-surface-container-highest rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Conversion Kit Cost Option */}
          <div className="pt-2 border-t border-slate-100">
            <span className="block text-[11.5px] font-bold text-slate-600 mb-1.5">Conversion Kit Cost Option</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsCommercialGrant(true)}
                className={`py-2 px-3 rounded-xl text-[12px] font-bold transition-all text-center border ${
                  isCommercialGrant
                    ? 'bg-emerald-50 text-primary border-primary'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Pi-CNG Free Grant (₦0)
              </button>
              <button
                type="button"
                onClick={() => setIsCommercialGrant(false)}
                className={`py-2 px-3 rounded-xl text-[12px] font-bold transition-all text-center border ${
                  !isCommercialGrant
                    ? 'bg-emerald-50 text-primary border-primary'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Private Kit (₦750k)
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Financial & Environmental Breakdown */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-surface rounded-xl p-3 border border-surface-container-highest">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Annual Savings</span>
            <span className="text-[15px] font-extrabold text-primary block mt-0.5">₦{annualSavings.toLocaleString()}</span>
          </div>

          <div className="bg-surface rounded-xl p-3 border border-surface-container-highest">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payback Period</span>
            <span className="text-[13.5px] font-extrabold text-slate-900 block mt-0.5">{paybackMonths}</span>
          </div>

          <div className="bg-surface rounded-xl p-3 border border-surface-container-highest">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">CO₂ Cut / Year</span>
            <span className="text-[13.5px] font-extrabold text-primary block mt-0.5">{annualCo2SavedTons} Tons</span>
          </div>
        </div>

        {/* Bottom CTA Action Button */}
        <div className="flex items-center gap-2 pt-1">
          {onOpenConversions && (
            <button
              onClick={() => {
                onClose();
                onOpenConversions();
              }}
              className="w-full h-12 bg-primary hover:bg-deep-teal text-white font-extrabold text-[13.5px] rounded-full flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">build_circle</span>
              <span>Find &amp; Book Accredited Conversion Center</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
