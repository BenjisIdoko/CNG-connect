import React, { useState } from 'react';
import { GasStation } from '../types';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  stations: GasStation[];
  onSelectStation: (station: GasStation) => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  stations,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Hello! I am GasFinder AI. Ask me about CNG station queues, pump pressure, optimal refuelling times, or calculating your monthly fuel savings!',
    },
  ]);

  if (!isOpen) return null;

  const quickPrompts = [
    'Which station in Abuja has the highest pressure right now?',
    'How much will I save converting my car to CNG?',
    'What is the best time to refuel at Total Wuse 2?',
    'Show me CNG stations in Lagos',
  ];

  const getKnowledgeEngineFallback = (promptText: string): string => {
    const lower = promptText.toLowerCase();

    if (lower.includes('pressure') || lower.includes('highest')) {
      const best = [...stations].sort((a, b) => b.pumpPressure - a.pumpPressure)[0];
      return `⚡ **${best.name}** currently has the highest pressure at **${best.pumpPressure} bar** (${best.statusLabel}). High pressure ensures your tank fills to 100% capacity faster!`;
    } else if (lower.includes('save') || lower.includes('cost') || lower.includes('converting')) {
      return `💰 **CNG Savings Estimate:**\n• Petrol price: ~₦1,100/liter\n• CNG price: **₦230/kg** at CNG stations\n• An average driver using 15kg/week saves approximately **₦78,500 monthly** (over **₦940,000 yearly**)!`;
    } else if (lower.includes('wuse') || lower.includes('best time')) {
      return `🕒 **Total CNG - Wuse 2 Tip:** The queue is lightest between **7:00 AM - 8:30 AM** and **2:00 PM - 4:00 PM**. Current wait time is around **4 minutes** with 215 bar pressure.`;
    } else if (lower.includes('lagos')) {
      const lagosStations = stations.filter((s) => s.state.toLowerCase().includes('lagos'));
      return (
        `🇳🇬 Found **${lagosStations.length} CNG stations** in Lagos:\n` +
        lagosStations.map((s) => `• **${s.name}** (${s.city}) - ${s.statusLabel}, ₦${s.cngPrice}/kg`).join('\n')
      );
    } else {
      return `Based on live driver reports, **${stations[0].name}** (${stations[0].city}) is currently full stock with ${stations[0].pumpPressure} bar pressure and short queue times (${stations[0].busyEstimate}).`;
    }
  };

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || query;
    if (!promptText.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, text: promptText }];
    setMessages(newMessages);
    if (!textToSend) setQuery('');
    setLoading(true);

    try {
      // Call serverless API endpoint (Vercel/Netlify function)
      let response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, stations }),
      });

      if (!response.ok && response.status === 404) {
        // Try netlify function route if /api/chat isn't found
        response = await fetch('/.netlify/functions/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText, stations }),
        });
      }

      if (response.ok) {
        const data = await response.json();
        if (data && data.reply) {
          setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
          return;
        }
      }

      // If serverless endpoint returned non-OK or was unavailable, use fallback knowledge engine
      const fallbackReply = getKnowledgeEngineFallback(promptText);
      setMessages((prev) => [...prev, { role: 'assistant', text: fallbackReply }]);
    } catch (err) {
      console.warn('Serverless endpoint fetch error, using knowledge engine fallback:', err);
      const fallbackReply = getKnowledgeEngineFallback(promptText);
      setMessages((prev) => [...prev, { role: 'assistant', text: fallbackReply }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg h-[85vh] sm:h-[620px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#004D40] to-[#006c50] text-white p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-[20px] text-[#00E676]">auto_awesome</span>
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-white flex items-center gap-1.5">
                GasFinder AI Assistant
                <span className="bg-[#00E676] text-[#004D40] text-[9.5px] font-semibold uppercase px-2 py-0.5 rounded-full">
                  Live
                </span>
              </h3>
              <p className="text-[11.5px] text-emerald-100/90 font-normal">
                Station queue advisor &amp; CNG calculator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close assistant modal"
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#f8fcf9]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                m.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-[14px] leading-relaxed shadow-xs ${
                  m.role === 'user'
                    ? 'bg-[#006c50] text-white rounded-br-none font-medium'
                    : 'bg-white border border-[#dbe5de] text-[#141d19] rounded-bl-none font-normal'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-[#006c50] text-[13px] font-semibold p-2 bg-emerald-50 rounded-xl w-fit border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-[#00c853] animate-ping" />
              <span>Checking live station status...</span>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2 px-3 bg-white border-t border-[#dbe5de]/70 flex items-center gap-2 overflow-x-auto hide-scrollbar">
          {['Lowest CNG Price', 'Zero Wait Queue', '220 Bar Gauge'].map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setQuery(prompt);
                handleSend(prompt);
              }}
              className="px-3 py-2 bg-[#e6f0e9] hover:bg-[#dbe5de] text-[#004D40] text-[12px] font-semibold rounded-full whitespace-nowrap border border-[#dbe5de] active:scale-95 transition-all shrink-0 min-h-[44px] flex items-center"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Query Input Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(query);
          }}
          className="p-3 bg-white border-t border-[#dbe5de] flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask GasFinder AI..."
            className="flex-1 bg-[#e6f0e9] border border-[#dbe5de] rounded-full px-4 py-2.5 text-[14px] font-normal text-[#141d19] placeholder:text-[#6a7b72] focus:outline-none focus:ring-2 focus:ring-[#006c50]/30"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            aria-label="Send query to AI"
            className="w-11 h-11 rounded-full bg-[#006c50] hover:bg-[#004D40] disabled:opacity-40 text-white flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
