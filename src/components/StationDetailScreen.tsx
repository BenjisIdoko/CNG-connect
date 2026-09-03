import React, { useEffect, useRef, useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { GasStation, CommentItem, UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import { openExternalMaps, openGoogleMapsPin } from '../utils/navigationHelper';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';
import { formatStationAge } from '../utils/timeUtils';
import { openWhatsAppShare } from '../utils/shareMessageBuilder';
import { EditStationLocationModal } from './EditStationLocationModal';

interface StationDetailScreenProps {
  station: GasStation;
  user?: UserProfile;
  onBack: () => void;
  onOpenReportModal: (station: GasStation) => void;
  onNavigate: (station: GasStation) => void;
  onAddStationComment?: (stationId: string, commentText: string) => void;
  onAddPhoto?: () => void;
  onUpdateLocation?: (stationId: string, lat: number, lng: number) => void;
  isPresenceActive?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (stationId: string) => void;
}

export const StationDetailScreen: React.FC<StationDetailScreenProps> = ({
  station,
  user,
  onBack,
  onOpenReportModal,
  onNavigate,
  onAddStationComment,
  onAddPhoto,
  onUpdateLocation,
  isPresenceActive = true,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [reports, setReports] = useState(station.reports || []);
  const [comments, setComments] = useState<CommentItem[]>(
    station.stationComments || [
      {
        id: `st-com-init-1`,
        author: 'Obinna N.',
        authorAvatar: ASSETS.obinnaAvatar,
        timeAgo: '20 min ago',
        content: `Welcoming everyone to the official ${station.name} Station Group! Please post real-time updates on queue lengths, pump pressures, and gas stock status here.`,
      },
    ]
  );
  const [newCommentText, setNewCommentText] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'reports' | 'photos'>('feed');
  const [isPresenceActiveState, setIsPresenceActiveState] = useState<boolean>(isPresenceActive);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);

  const getFormattedStatusPillText = (st: GasStation): string => {
    const isEv = st.stationType === 'ev_charging';
    let baseLabel = '';
    if (st.status === 'full') {
      baseLabel = 'Available';
    } else if (st.status === 'queue') {
      baseLabel = 'Queuing';
    } else if (st.status === 'low') {
      baseLabel = isEv ? 'Low availability' : 'Low pressure';
    } else if (st.status === 'out') {
      baseLabel = isEv ? 'Out of service' : 'Out of gas';
    } else {
      const raw = st.statusLabel ? st.statusLabel.replace(/\s*\([^)]*\)/g, '').trim() : 'Unknown';
      baseLabel = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }

    if (st.busyEstimate) {
      let detail = st.busyEstimate;
      detail = detail.replace(/\(?(\d+)\/(\d+)\s*ports\s*free\)?/i, '$1 of $2 ports free');
      detail = detail.replace(/^\((.*)\)$/, '$1').trim();
      if (detail) {
        return `${baseLabel} · ${detail}`;
      }
    }

    return baseLabel;
  };

  useEffect(() => {
    setReports(station.reports || []);
    if (station.stationComments && station.stationComments.length > 0) {
      setComments(station.stationComments);
    }
  }, [station]);

  useEffect(() => {
    setIsPresenceActiveState(isPresenceActive);
  }, [isPresenceActive]);

  const getFreshnessBadgeInfo = (timeAgo: string) => {
    const lower = timeAgo.toLowerCase();
    let minutes = 999;

    if (lower.includes('min') || lower.includes('m ago')) {
      const match = lower.match(/\d+/);
      if (match) minutes = parseInt(match[0], 10);
      else minutes = 15;
    } else if (lower.includes('hour') || lower.includes('h ago')) {
      const match = lower.match(/\d+/);
      if (match) minutes = parseInt(match[0], 10) * 60;
      else minutes = 60;
    } else if (lower.includes('just now') || lower.includes('sec')) {
      minutes = 2;
    } else if (lower.includes('day') || lower.includes('yesterday')) {
      minutes = 1440;
    }

    if (minutes < 30) {
      return {
        label: `Fresh · ${timeAgo}`,
        dotColor: 'bg-status-green',
      };
    } else if (minutes <= 120) {
      return {
        label: `Recent · ${timeAgo}`,
        dotColor: 'bg-status-orange',
      };
    } else {
      return {
        label: `Stale · ${timeAgo}`,
        dotColor: 'bg-status-red',
      };
    }
  };

  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem('hasSeenGroupPolicy');
      if (!hasSeen) {
        setShowInfoSheet(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const images = station.images || [];
  const presenceCount = station.activePresenceCount || 0;

  const handleVote = (reportId: string, type: 'up' | 'down') => {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id === reportId) {
          if (type === 'up') {
            const isCurrentlyUp = r.userVoted === 'up';
            return {
              ...r,
              likes: isCurrentlyUp ? r.likes - 1 : r.likes + 1,
              dislikes: r.userVoted === 'down' ? (r.dislikes || 1) - 1 : r.dislikes,
              userVoted: isCurrentlyUp ? null : 'up',
            };
          } else {
            const isCurrentlyDown = r.userVoted === 'down';
            return {
              ...r,
              dislikes: isCurrentlyDown ? (r.dislikes || 1) - 1 : (r.dislikes || 0) + 1,
              likes: r.userVoted === 'up' ? r.likes - 1 : r.likes,
              userVoted: isCurrentlyDown ? null : 'down',
            };
          }
        }
        return r;
      })
    );
  };

  const handlePostGroupComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const text = newCommentText.trim();
    const newComment: CommentItem = {
      id: `st-comment-${Date.now()}`,
      author: user?.name || 'Anonymous Driver',
      authorAvatar: user?.avatar || '',
      timeAgo: 'Just now',
      content: text,
    };

    setComments((prev) => [newComment, ...prev]);
    if (onAddStationComment) {
      onAddStationComment(station.id, text);
    }
    setNewCommentText('');
  };

  const handleShareStation = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `${station.name} Station Group`,
          text: `Join ${station.name} Station Group on CNG-Connect! Live CNG Status: ${station.statusLabel}, ₦${station.cngPrice}/kg, Pressure: ${station.pumpPressure} bar.`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(
          `${station.name} Station Group (${station.address}): Live Status: ${station.statusLabel} • ₦${station.cngPrice}/kg • Pressure: ${station.pumpPressure} bar`
        )
        .then(() => {
          setCopiedNotification(true);
          if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
          copiedTimerRef.current = setTimeout(() => setCopiedNotification(false), 2500);
        })
        .catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-36 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-white text-[13px] font-bold px-4 py-2 rounded-full shadow-lg">
          Station Group link copied!
        </div>
      )}

      {/* Sticky Top Header Navigation Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-xs">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="flex items-center gap-1.5 text-slate-700 font-bold text-[13.5px] hover:text-primary active:scale-95 transition-all min-h-[44px] min-w-[44px] px-1"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="bg-emerald-50 text-primary border border-emerald-200 px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${presenceCount > 0 ? 'bg-live-pulse animate-pulse' : 'bg-slate-300'}`} />
            <span>{presenceCount > 0 ? `${presenceCount} drivers here now` : 'Live presence unavailable'}</span>
          </div>

          <button
            onClick={() => onToggleFavorite?.(station.id)}
            aria-label={isFavorite ? 'Remove from favorite stations' : 'Add to favorite stations'}
            title={isFavorite ? 'Favorite station (Alerts enabled)' : 'Add to favorite stations for push alerts'}
            className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 cursor-pointer ${
              isFavorite
                ? 'bg-rose-100 text-rose-600 border border-rose-200 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] ${isFavorite ? 'text-rose-600' : ''}`}>
              {isFavorite ? 'favorite' : 'favorite_border'}
            </span>
          </button>

          <button
            onClick={handleShareStation}
            aria-label="Share Station Group"
            className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-primary flex items-center justify-center active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-4 flex flex-col gap-4">
        {/* Redesigned Station Group Header Card with Top Hero Photo */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Top Hero Photo Area with Consolidated Overlay Bar */}
          <div className="relative h-44 sm:h-52 w-full bg-slate-900 overflow-hidden">
            <img
              src={images?.[0] || ASSETS.stationWide}
              alt={station.name}
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute bottom-0 inset-x-0 bg-black/55 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between text-white text-caption font-semibold">
              <span>{station.distance} · {station.driveTime}</span>
              <span>{station.stationType === 'ev_charging' ? 'EV hub' : 'CNG station'}</span>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-5 flex flex-col gap-3">
            {/* Title (One line, truncated, font-bold/700, tap to toggle full name) */}
            <div>
              <h1
                onClick={() => setShowFullTitle(!showFullTitle)}
                title={station.name}
                className={`text-[20px] sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug cursor-pointer ${
                  showFullTitle ? '' : 'truncate'
                }`}
              >
                {station.name}
              </h1>

              {/* Quiet Metadata Line (Category + Address + Info Icon) */}
              <div className="flex flex-col gap-0.5 mt-1">
                <p className="text-caption font-normal text-on-surface-variant flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-primary text-[16px] shrink-0">location_on</span>
                  <span className="truncate">
                    {station.verifiedByCommunity ? 'Community station' : 'Station group'} · {station.address}
                  </span>
                  <button
                    onClick={() => setShowInfoSheet(true)}
                    className="inline-flex items-center text-on-surface-variant/70 hover:text-on-surface-variant shrink-0"
                    title="Station Group Guidelines"
                  >
                    <span className="material-symbols-outlined text-[16px]">info</span>
                  </button>
                </p>

                {/* Approximate location caveat (quiet inline text, indented under address text) */}
                {station.locationPrecision !== 'source_exact' && station.locationPrecision !== 'gps_confirmed' && (
                  <p className="text-micro font-medium text-status-orange pl-[22px] leading-tight">
                    <span>Approximate location</span>
                    {onUpdateLocation && (
                      <>
                        <span> · </span>
                        <button
                          onClick={() => setShowEditLocationModal(true)}
                          className="text-primary underline hover:opacity-85 font-medium transition-opacity"
                        >
                          Fix pin
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Consolidated Live Status Row */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              {station.status === 'unknown' ? (
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-on-surface-variant bg-surface-container/50 px-3.5 py-2.5 rounded-2xl border border-surface-container-highest">
                  <span className="material-symbols-outlined text-slate-400 text-[18px]">schedule</span>
                  <span>No driver status reports yet. Be the first to report stock &amp; queue below!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Dominant Status Pill: Solid bg-primary ONLY when available */}
                  <div
                    className={`rounded-full px-3.5 py-1.5 flex items-center gap-1.5 shadow-2xs ${
                      station.status === 'full'
                        ? 'bg-primary text-white font-semibold'
                        : station.status === 'low' || station.status === 'queue'
                        ? 'bg-status-orange text-white font-semibold'
                        : 'bg-status-red text-white font-semibold'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {station.status === 'full'
                        ? 'check_circle'
                        : station.status === 'queue'
                        ? 'schedule'
                        : station.status === 'low'
                        ? 'battery_3_bar'
                        : 'not_interested'}
                    </span>
                    <span className="text-caption font-semibold">
                      {getFormattedStatusPillText(station)}
                    </span>
                  </div>
                </div>
              )}

              <span className="text-caption font-medium text-on-surface-variant">
                {formatStationAge(station)}
              </span>
            </div>

            {/* Secondary Actions Row (External Map Pin link if present) */}
            {station.lat && station.lng && (
              <div className="pt-2.5 mt-1 border-t border-surface-container-highest flex items-center justify-end text-micro text-on-surface-variant">
                <button
                  onClick={() => openGoogleMapsPin(station)}
                  className="font-medium text-on-surface-variant hover:text-on-surface underline flex items-center gap-1 transition-colors"
                  title="Open in Google Maps"
                >
                  <span className="material-symbols-outlined text-[14px]">map</span>
                  <span>Map pin</span>
                  <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Conditional Specs: EV Charging Fields vs CNG Fields */}
        {station.stationType === 'ev_charging' ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {/* EV Rate Bento Card */}
              <div className="bg-white rounded-2xl p-4 border border-surface-container-highest shadow-xs flex flex-col justify-between">
                <span className="text-micro font-bold text-slate-400 uppercase tracking-wider">
                  EV Charging Rate
                </span>
                <div className="flex items-baseline gap-1 my-1">
                  {station.pricePerKwh ? (
                    <>
                      <span className="text-display font-bold text-sky-700">
                        ₦{station.pricePerKwh}
                      </span>
                      <span className="text-body font-normal text-slate-400">/kWh</span>
                    </>
                  ) : (
                    <span className="text-title font-bold text-slate-400">
                      Standard Rate
                    </span>
                  )}
                </div>
                <span className="text-micro font-bold text-sky-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">hub</span>
                  <span>{station.network || 'EV Network'}</span>
                </span>
              </div>

              {/* Charging Power & Ports Card */}
              <div className="bg-white rounded-2xl p-4 border border-surface-container-highest shadow-xs flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-micro font-bold text-slate-400 uppercase tracking-wider">
                    Charging Power
                  </span>
                  <span className="text-micro font-extrabold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    {station.chargingSpeedKw && station.chargingSpeedKw >= 100 ? 'Supercharger' : 'Fast DC'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-display font-bold text-sky-900">
                    {station.chargingSpeedKw || 120}
                  </span>
                  <span className="text-body font-bold text-sky-700">kW</span>
                </div>
                <span className="text-micro font-bold text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">power</span>
                  <span>{station.totalPorts ? `${station.totalPorts} Charging Ports` : 'Multi-Port Station'}</span>
                </span>
              </div>
            </div>

            {/* EV Connector Types */}
            {station.connectorTypes && station.connectorTypes.length > 0 && (
              <div className="bg-sky-50/60 rounded-2xl p-3.5 border border-sky-100 flex flex-col gap-1.5">
                <span className="text-micro font-extrabold text-sky-900 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">electrical_services</span>
                  <span>Available Plug Connectors</span>
                </span>
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {station.connectorTypes.map((type, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-white border border-sky-200 text-sky-900 rounded-full text-caption font-extrabold shadow-2xs flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[13px] text-sky-600">bolt</span>
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Price & Pump Pressure Bento Cards */
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-surface-container-highest shadow-xs flex flex-col justify-between">
              <span className="text-micro font-bold text-slate-400 uppercase tracking-wider">
                CNG Price
              </span>
              <div className="flex items-baseline gap-1 my-1">
                {station.cngPrice ? (
                  <>
                    <span className="text-display font-bold text-deep-teal">
                      ₦{station.cngPrice}
                    </span>
                    <span className="text-body font-normal text-slate-400">/kg</span>
                  </>
                ) : (
                  <span className="text-title font-bold text-slate-400">
                    Unreported
                  </span>
                )}
              </div>
              <span className="text-micro font-semibold text-primary flex items-center gap-1">
                <span>{station.cngPrice ? (station.priceTrend === 'stable' ? 'Official Rate' : 'Updated') : 'No price reports yet'}</span>
              </span>
            </div>

            {/* Interactive 220-Bar SVG Pump Pressure Arc Gauge Bento Card */}
            <div className="bg-white rounded-2xl p-4 border border-surface-container-highest shadow-xs flex flex-col justify-between relative overflow-hidden group">
              <div className="flex justify-between items-center">
                <span className="text-micro font-bold text-slate-400 uppercase tracking-wider">
                  Pump Pressure
                </span>
                <span
                  className={`text-micro font-semibold px-2 py-0.5 rounded-full border ${
                    !station.pumpPressure
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : station.pumpPressure >= 180
                      ? 'bg-emerald-50 text-primary border-emerald-200'
                      : station.pumpPressure >= 130
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}
                >
                  {!station.pumpPressure
                    ? 'No data'
                    : station.pumpPressure >= 180
                    ? 'Optimal'
                    : station.pumpPressure >= 130
                    ? 'Moderate'
                    : 'Low'}
                </span>
              </div>

              {station.pumpPressure ? (
                <>
                  <div className="relative flex flex-col items-center justify-center my-0.5">
                    <svg viewBox="0 0 100 55" className="w-28 h-16 transform transition-transform group-hover:scale-105">
                      {/* Background Track Arc */}
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="var(--color-surface-container)"
                        strokeWidth="9"
                        strokeLinecap="round"
                      />
                      {/* Gauge Colored Arc */}
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke={
                          station.pumpPressure >= 180
                            ? '#00E676'
                            : station.pumpPressure >= 130
                            ? '#FF6D00'
                            : '#FF3D00'
                        }
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray="126"
                        strokeDashoffset={126 - (126 * Math.min(station.pumpPressure, 220)) / 220}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                      <span className="text-[20px] font-extrabold text-on-surface leading-none tracking-tight">
                        {station.pumpPressure}
                      </span>
                      <span className="text-micro font-semibold text-slate-400 uppercase tracking-widest -mt-0.5">
                        bar
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-micro font-bold text-slate-400 pt-1 border-t border-slate-100">
                    <span>0 bar</span>
                    <span className="text-primary font-semibold">{Math.round((station.pumpPressure / 220) * 100)}% Max</span>
                    <span>220 bar</span>
                  </div>
                </>
              ) : (
                <div className="my-2 text-center flex flex-col items-center justify-center py-1">
                  <span className="material-symbols-outlined text-[22px] text-slate-400 mb-0.5">speed</span>
                  <p className="text-micro font-bold text-slate-700 leading-tight">No reports yet — be the first</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Radix Accessible 3-Way Tabs Switcher */}
        <TabsPrimitive.Root value={activeTab} onValueChange={(val) => setActiveTab(val as 'feed' | 'reports' | 'photos')} className="w-full">
          <TabsPrimitive.List className="flex bg-surface-container p-1 rounded-2xl border border-surface-container-highest">
            <TabsPrimitive.Trigger
              value="feed"
              className="flex-1 py-2.5 rounded-xl text-caption font-bold transition-all text-center data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <span className="whitespace-nowrap">Group Chat ({comments.length})</span>
            </TabsPrimitive.Trigger>

            <TabsPrimitive.Trigger
              value="reports"
              className="flex-1 py-2.5 rounded-xl text-caption font-bold transition-all text-center data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <span className="whitespace-nowrap">Driver Reports ({reports.length})</span>
            </TabsPrimitive.Trigger>

            <TabsPrimitive.Trigger
              value="photos"
              className="flex-1 py-2.5 rounded-xl text-caption font-bold transition-all text-center data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <span className="whitespace-nowrap">Photos ({images.length})</span>
            </TabsPrimitive.Trigger>
          </TabsPrimitive.List>

          {/* TAB CONTENT 1: Station Group Chat Feed & Discussion */}
          <TabsPrimitive.Content value="feed" className="mt-3 outline-none">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-body-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    chat_bubble
                  </span>
                  <span>Group Discussion Feed</span>
                </h2>
                <span className="text-micro font-semibold text-primary bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  Open Group Chat
                </span>
              </div>

              {/* Comments List */}
              <div className="flex flex-col gap-3">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-white rounded-2xl p-4 border border-surface-container-highest shadow-xs flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {comment.authorAvatar ? (
                          <img
                            src={comment.authorAvatar}
                            alt={comment.author}
                            className="w-9 h-9 rounded-full object-cover border border-surface-container-highest"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[14px]">
                            {comment.author.charAt(0)}
                          </div>
                        )}
                        <div>
                          <span className="text-[13.5px] font-semibold text-slate-900">
                            {comment.author}
                          </span>
                          <span className="text-[11px] font-normal text-slate-400 ml-2">
                            {comment.timeAgo}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[13.5px] font-normal text-slate-700 leading-relaxed pl-1">
                      {comment.content}
                    </p>

                    {/* Replies if any */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-2 ml-4 pl-3 border-l-2 border-primary/30 flex flex-col gap-2">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="pt-1">
                            <div className="flex items-center gap-2">
                              {reply.authorAvatar && (
                                <img
                                  src={reply.authorAvatar}
                                  alt={reply.author}
                                  className="w-5 h-5 rounded-full object-cover"
                                />
                              )}
                              <span className="text-[12px] font-semibold text-slate-900">
                                {reply.author}
                              </span>
                              <span className="text-[10px] font-normal text-slate-400">
                                {reply.timeAgo}
                              </span>
                            </div>
                            <p className="text-[13px] font-normal text-slate-700 mt-0.5">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsPrimitive.Content>

          {/* TAB CONTENT 2: Driver Status Reports */}
          <TabsPrimitive.Content value="reports" className="mt-3 outline-none">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[17px] font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    verified_user
                  </span>
                  <span>Verified Driver Status Reports ({reports.length})</span>
                </h2>
              </div>

              <div className="flex flex-col gap-3">
                {reports.map((report) => {
                  const freshness = getFreshnessBadgeInfo(report.timestamp);
                  return (
                    <div
                      key={report.id}
                      className="bg-white rounded-2xl p-4 border border-surface-container-highest shadow-xs flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {report.authorAvatar ? (
                            <img
                              src={report.authorAvatar}
                              alt={report.author}
                              className="w-10 h-10 rounded-full object-cover border border-surface-container-highest shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-secondary-container/20 text-secondary font-bold flex items-center justify-center text-[16px] shrink-0">
                              {report.author.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[14px] font-bold text-on-surface truncate">
                                {report.author}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold flex items-center gap-0.5 shrink-0">
                                <span>🥇</span>
                                <span>Verified Reporter</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant whitespace-nowrap">
                                <span className={`w-1.5 h-1.5 rounded-full ${freshness.dotColor}`} />
                                <span>{freshness.label}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {report.verified && report.isPhotoVerified ? (
                          <div className="bg-emerald-100 border border-emerald-300 text-primary px-2.5 py-1 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shadow-2xs shrink-0 whitespace-nowrap">
                            <span
                              className="material-symbols-outlined text-[14px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              verified
                            </span>
                            <span>Photo Verified</span>
                          </div>
                        ) : (
                          <div className="bg-amber-100 border border-amber-300/80 text-amber-900 px-2.5 py-1 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shadow-2xs shrink-0 whitespace-nowrap">
                            <span className="material-symbols-outlined text-[14px]">
                              gavel
                            </span>
                            <span>Unverified</span>
                          </div>
                        )}
                      </div>

                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          report.status === 'full'
                            ? 'bg-status-green'
                            : report.status === 'low'
                            ? 'bg-status-orange'
                            : report.status === 'queue'
                            ? 'bg-status-orange'
                            : 'bg-status-red'
                        }`}
                      />
                      <span className="text-[13.5px] font-bold text-on-surface">
                        {report.statusLabel}{' '}
                        {report.waitMinutes ? `(${report.waitMinutes}m wait)` : ''}
                      </span>
                    </div>

                    {report.comment && (
                      <p className="text-[14px] font-normal text-on-surface-variant leading-relaxed">
                        {report.comment}
                      </p>
                    )}

                    {!report.verified && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2 text-[11.5px] font-normal flex items-center gap-1.5 mt-0.5">
                        <span className="material-symbols-outlined text-[15px] text-amber-700">info</span>
                        <span>Unverified update: No live photo attached to confirm this report.</span>
                      </div>
                    )}

                    {report.photo && (
                      <div
                        onClick={() => setSelectedPhoto(report.photo!)}
                        className="w-32 h-24 rounded-lg overflow-hidden border border-surface-container-highest mt-1 cursor-pointer"
                      >
                        <img
                          src={report.photo}
                          alt="Report snapshot"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Actions (Like / Dislike) */}
                    <div className="flex items-center gap-3 pt-2 border-t border-surface-container-highest/50 mt-1">
                      <button
                        onClick={() => handleVote(report.id, 'up')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold transition-all ${
                          report.userVoted === 'up'
                            ? 'bg-primary text-white'
                            : 'bg-surface text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={{
                            fontVariationSettings:
                              report.userVoted === 'up' ? "'FILL' 1" : "'FILL' 0",
                          }}
                        >
                          thumb_up
                        </span>
                        <span>{report.likes}</span>
                      </button>

                      <button
                        onClick={() => handleVote(report.id, 'down')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold transition-all ${
                          report.userVoted === 'down'
                            ? 'bg-error text-white'
                            : 'bg-surface text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={{
                            fontVariationSettings:
                              report.userVoted === 'down' ? "'FILL' 1" : "'FILL' 0",
                          }}
                        >
                          thumb_down
                        </span>
                        {report.dislikes ? <span>{report.dislikes}</span> : null}
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          </TabsPrimitive.Content>

          {/* TAB CONTENT 3: Station Photos Gallery */}
          <TabsPrimitive.Content value="photos" className="mt-3 outline-none">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-[17px] font-bold text-on-surface">
                  Station &amp; Pump Photos ({images.length})
                </h2>
                <button
                  onClick={() => onOpenReportModal(station)}
                  className="text-[12.5px] font-semibold text-primary flex items-center gap-1 hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                  <span>Add Photo</span>
                </button>
              </div>

              {images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedPhoto(imgUrl)}
                      className="w-full h-36 rounded-xl overflow-hidden border border-surface-container-highest shadow-xs cursor-pointer relative group bg-surface-container"
                    >
                      <img
                        src={imgUrl}
                        alt={`Station photo ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/80 shadow-xs flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-[36px] text-slate-400">photo_camera</span>
                  <h4 className="font-extrabold text-slate-900 text-[15px]">No Driver Photos Uploaded Yet</h4>
                  <p className="text-[12px] text-slate-500 font-medium max-w-xs">
                    Only live camera photos taken at this station are displayed here.
                  </p>
                  <button
                    onClick={() => onOpenReportModal(station)}
                    className="mt-1 px-4 py-2 bg-primary hover:bg-deep-teal text-white text-[12px] font-extrabold rounded-full shadow-md active:scale-95 transition-all"
                  >
                    Capture Live Photo
                  </button>
                </div>
              )}
            </div>
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      </div>

      {/* Sticky Bottom Action & Group Comment Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-3 px-4 border-t border-surface-container-highest shadow-lg z-40 pb-safe">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          {/* Main Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenReportModal(station)}
              aria-label="Update station status"
              title="Update status"
              className="w-12 h-12 min-w-[48px] min-h-[48px] bg-primary hover:bg-deep-teal text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">
                edit_document
              </span>
            </button>

            <button
              onClick={() => {
                openExternalMaps(station);
                if (onNavigate) {
                  onNavigate(station);
                }
              }}
              className="flex-1 h-12 bg-primary hover:bg-deep-teal text-white font-extrabold text-body rounded-full flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-all px-3 min-w-0"
            >
              <span
                className="material-symbols-outlined text-[18px] shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                navigation
              </span>
              <span className="whitespace-nowrap truncate">Get Directions</span>
              <span className="bg-emerald-800/70 text-emerald-100 text-micro font-bold px-2 py-0.5 rounded-xl ml-0.5 shrink-0">
                {station.distance}
              </span>
            </button>

            <button
              onClick={() => openWhatsAppShare(station)}
              aria-label="Share update on WhatsApp"
              title="Share to WhatsApp"
              className="px-3 h-12 bg-emerald-50 hover:bg-emerald-100 text-primary border border-surface-container-highest font-bold text-body rounded-full flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">
                share
              </span>
              <span className="whitespace-nowrap">Share</span>
            </button>
          </div>

          {/* Station Group Comment Input (Open to All Drivers) */}
          <form onSubmit={handlePostGroupComment} className="flex items-center gap-2 pt-1">
            <div className="flex-1 bg-surface-container rounded-full h-11 flex items-center px-4 border border-surface-container-highest">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={`Post message to ${station.name} Group...`}
                className="w-full bg-transparent border-none outline-none text-body text-on-surface placeholder:text-outline"
              />
            </div>
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              aria-label="Post comment to station group"
              className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-sm hover:bg-deep-teal disabled:opacity-40 transition-all active:scale-95 shrink-0"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                send
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Photo Lightbox Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="relative max-w-2xl max-h-[85vh] w-full flex flex-col items-center">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-white p-2 rounded-full hover:bg-white/20"
            >
              <span className="material-symbols-outlined text-[32px]">close</span>
            </button>
            <img
              src={selectedPhoto}
              alt="Station View"
              className="w-full h-auto max-h-[75vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      <StationGroupInfoSheet
        isOpen={showInfoSheet}
        onClose={() => setShowInfoSheet(false)}
      />

      {showEditLocationModal && onUpdateLocation && (
        <EditStationLocationModal
          station={station}
          onClose={() => setShowEditLocationModal(false)}
          onSaveLocation={(stId, lat, lng) => {
            onUpdateLocation(stId, lat, lng);
            setShowEditLocationModal(false);
          }}
        />
      )}
    </div>
  );
};
