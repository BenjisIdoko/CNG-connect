import React, { useEffect, useRef, useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { TabUnderline } from './common/TabUnderline';
import { GasStation, CommentItem, UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import { openExternalMaps, openGoogleMapsPin } from '../utils/navigationHelper';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';
import { formatStationAge, formatRelativeTime, isIsoTimestamp, minutesSince } from '../utils/timeUtils';
import { openWhatsAppShare } from '../utils/shareMessageBuilder';
import { describeLocationPrecision } from '../utils/locationPrecision';
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
  const [activeTab, setActiveTab] = useState<'feed' | 'reports' | 'photos'>('reports');
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const [isPresenceActiveState, setIsPresenceActiveState] = useState<boolean>(isPresenceActive);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);

  const getFormattedStatusPillText = (st: GasStation): string => {
    const isEv = st.stationType === 'ev_charging';
    let baseLabel: string;
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

  const getFreshnessBadgeInfo = (raw: string) => {
    const iso = isIsoTimestamp(raw);
    const timeAgo = iso ? formatRelativeTime(raw) : raw;
    const lower = timeAgo.toLowerCase();
    let minutes = iso ? minutesSince(raw) : 999;

    if (iso) {
      // minutes already exact
    } else if (lower.includes('min') || lower.includes('m ago')) {
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
    const pricePart = station.cngPrice ? ` • ₦${station.cngPrice}/kg` : '';
    const pressurePart = station.pumpPressure ? ` • Pressure: ${station.pumpPressure} bar` : '';
    if (navigator.share) {
      navigator
        .share({
          title: `${station.name} Station Group`,
          text: `Join ${station.name} Station Group on CNG-Connect! Status: ${station.statusLabel}${pricePart}${pressurePart}.`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(
          `${station.name} Station Group (${station.address}): Status: ${station.statusLabel}${pricePart}${pressurePart}`
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
    <div className="min-h-screen bg-surface text-on-surface pb-44">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-white text-[0.875rem] font-bold px-4 py-2 rounded-full shadow-lg">
          Station Group link copied!
        </div>
      )}

      {/* Hero photo with floating actions */}
      <div className="relative h-44 w-full bg-slate-900 overflow-hidden md:max-w-4xl md:mx-auto md:rounded-b-3xl">
        <img src={images?.[0] || ASSETS.stationWide} alt={station.name} className="w-full h-full object-cover" />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
        <button
          onClick={onBack}
          aria-label="Go back"
          className="absolute top-[max(env(safe-area-inset-top,0px),1rem)] left-4 w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="absolute top-[max(env(safe-area-inset-top,0px),1rem)] right-4 flex gap-2">
          <button
            onClick={() => onToggleFavorite?.(station.id)}
            aria-label={isFavorite ? 'Remove from favorite stations' : 'Add to favorite stations'}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-sm ${
              isFavorite ? 'bg-white text-status-red' : 'bg-white/90 text-slate-900'
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] ${isFavorite ? 'material-symbols-fill' : ''}`}>
              favorite
            </span>
          </button>
          <button
            onClick={handleShareStation}
            aria-label="Share Station Group"
            className="w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">ios_share</span>
          </button>
        </div>
        <div className="absolute bottom-2.5 inset-x-4 flex items-center justify-between text-white text-micro font-semibold">
          <span>
            {station.distance}
            {station.driveTime ? ` · ${station.driveTime}` : ''}
          </span>
          <span>{station.stationType === 'ev_charging' ? 'EV hub' : 'CNG station'}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-5 pt-4 flex flex-col gap-5">
        {/* Identity + live status */}
        <div>
          <h1
            onClick={() => setShowFullTitle(!showFullTitle)}
            title={station.name}
            className={`text-title font-extrabold text-slate-900 tracking-tight cursor-pointer ${
              showFullTitle ? '' : 'truncate'
            }`}
          >
            {station.name}
          </h1>
          <p className="text-caption text-outline mt-0.5 flex items-center gap-1 min-w-0">
            <span className="truncate">{station.address}</span>
            <button
              onClick={() => setShowInfoSheet(true)}
              className="shrink-0 text-outline/70 hover:text-outline"
              aria-label="Station group guidelines"
            >
              <span className="material-symbols-outlined text-[15px]">info</span>
            </button>
          </p>
          {describeLocationPrecision(station) && (
            <p className="text-micro font-medium text-status-orange mt-1">
              {describeLocationPrecision(station)}
              {onUpdateLocation && (
                <>
                  {' · '}
                  <button onClick={() => setShowEditLocationModal(true)} className="text-primary underline font-semibold">
                    Fix pin
                  </button>
                </>
              )}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {station.status === 'unknown' ? (
              <span className="text-caption text-outline">No driver reports yet</span>
            ) : (
              <>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    station.status === 'full'
                      ? 'bg-status-green'
                      : station.status === 'queue'
                      ? 'bg-status-amber'
                      : station.status === 'low'
                      ? 'bg-status-orange'
                      : 'bg-status-red'
                  }`}
                />
                <span className="text-caption font-bold text-slate-900">
                  {station.status === 'full'
                    ? 'Available'
                    : station.status === 'queue'
                    ? 'Queuing'
                    : station.status === 'low'
                    ? 'Low pressure'
                    : 'Out of service'}
                </span>
                <span className="text-caption text-outline">· {formatStationAge(station).toLowerCase()}</span>
              </>
            )}
            {presenceCount > 0 && (
              <span className="ml-auto flex items-center gap-1.5 text-micro font-semibold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-live-pulse animate-pulse" />
                {presenceCount} here now
              </span>
            )}
          </div>
        </div>

        {/* Key numbers */}
        {station.stationType === 'ev_charging' ? (
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="text-[0.75rem] font-bold text-outline uppercase tracking-wider">Rate</div>
              <div className={`font-extrabold mt-1 ${station.pricePerKwh ? 'text-heading text-slate-900' : 'text-body-lg text-slate-300'}`}>
                {station.pricePerKwh ? `₦${station.pricePerKwh}/kWh` : 'Unreported'}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[0.75rem] font-bold text-outline uppercase tracking-wider">Power</div>
              <div className="font-extrabold mt-1 text-heading text-slate-900">
                {station.chargingSpeedKw ? `${station.chargingSpeedKw} kW` : '—'}
              </div>
              {station.connectorTypes && station.connectorTypes.length > 0 && (
                <div className="text-micro text-outline mt-0.5">{station.connectorTypes.join(' · ')}</div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex gap-6">
              <div className="flex-1">
                <div className="text-[0.75rem] font-bold text-outline uppercase tracking-wider">CNG price</div>
                <div
                  className={`font-extrabold mt-1 ${
                    station.cngPrice ? 'text-heading text-slate-900' : 'text-body-lg text-slate-300'
                  }`}
                >
                  {station.cngPrice ? (
                    <>
                      ₦{station.cngPrice}
                      <span className="text-caption font-semibold text-outline">/kg</span>
                    </>
                  ) : (
                    'Unreported'
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[0.75rem] font-bold text-outline uppercase tracking-wider">Pump pressure</div>
                <div
                  className={`font-extrabold mt-1 ${
                    station.pumpPressure ? 'text-heading text-slate-900' : 'text-body-lg text-slate-300'
                  }`}
                >
                  {station.pumpPressure ? (
                    <>
                      {station.pumpPressure}
                      <span className="text-caption font-semibold text-outline"> bar</span>
                    </>
                  ) : (
                    'No data'
                  )}
                </div>
                {station.pumpPressure ? (
                  <div className="h-1.5 rounded-full bg-surface-container-high mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        station.pumpPressure >= 180
                          ? 'bg-status-green'
                          : station.pumpPressure >= 130
                          ? 'bg-status-amber'
                          : 'bg-status-orange'
                      }`}
                      style={{ width: `${Math.min(100, (station.pumpPressure / 220) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {!station.cngPrice && !station.pumpPressure && (
              <p className="text-micro text-on-surface-variant mt-2">No reports yet — be the first to add one</p>
            )}
          </div>
        )}

        {station.lat && station.lng && (
          <button
            onClick={() => openGoogleMapsPin(station)}
            className="self-start -mt-2 text-micro font-semibold text-outline hover:text-slate-900 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">map</span>
            View map pin
            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
          </button>
        )}

        {/* Radix Accessible 3-Way Tabs Switcher */}
        <TabsPrimitive.Root value={activeTab} onValueChange={(val) => setActiveTab(val as 'feed' | 'reports' | 'photos')} className="w-full">
          <TabsPrimitive.List ref={tabListRef} className="relative flex gap-6 border-b border-surface-container-highest">
            <TabsPrimitive.Trigger
              value="feed"
              className="pb-2.5 -mb-px text-caption font-semibold text-outline border-b-2 border-transparent transition-colors data-[state=active]:text-slate-900 data-[state=active]:font-extrabold focus:outline-none"
            >
              Chat{comments.length > 0 ? ` · ${comments.length}` : ''}
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger
              value="reports"
              className="pb-2.5 -mb-px text-caption font-semibold text-outline border-b-2 border-transparent transition-colors data-[state=active]:text-slate-900 data-[state=active]:font-extrabold focus:outline-none"
            >
              Reports{reports.length > 0 ? ` · ${reports.length}` : ''}
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger
              value="photos"
              className="pb-2.5 -mb-px text-caption font-semibold text-outline border-b-2 border-transparent transition-colors data-[state=active]:text-slate-900 data-[state=active]:font-extrabold focus:outline-none"
            >
              Photos{images.length > 0 ? ` · ${images.length}` : ''}
            </TabsPrimitive.Trigger>
            <TabUnderline listRef={tabListRef} active={activeTab} deps={[comments.length, reports.length, images.length]} />
          </TabsPrimitive.List>

          {/* TAB CONTENT 1: Station Group Chat Feed & Discussion */}
          <TabsPrimitive.Content value="feed" className="mt-4 outline-none">
            {comments.length === 0 ? (
              <p className="text-caption text-outline py-6 text-center">No messages yet. Say hi to drivers here.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 items-start">
                    {comment.authorAvatar ? (
                      <img src={comment.authorAvatar} alt={comment.author} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-container-highest text-slate-600 font-bold flex items-center justify-center text-caption shrink-0">
                        {comment.author.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-caption font-bold text-slate-900 truncate">{comment.author}</span>
                        <span className="text-micro text-outline shrink-0">{comment.timeAgo}</span>
                      </div>
                      <p className="text-caption text-on-surface-variant mt-0.5 leading-relaxed">{comment.content}</p>
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="mt-2 pl-3 border-l-2 border-surface-container-highest flex flex-col gap-2">
                          {comment.replies.map((reply) => (
                            <div key={reply.id}>
                              <span className="text-micro font-bold text-slate-900">{reply.author}</span>
                              <span className="text-micro text-outline"> · {reply.timeAgo}</span>
                              <p className="text-caption text-on-surface-variant">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsPrimitive.Content>

          {/* TAB CONTENT 2: Driver Status Reports */}
          <TabsPrimitive.Content value="reports" className="mt-4 outline-none">
            {reports.length === 0 ? (
              <p className="text-caption text-outline py-6 text-center">
                No driver reports yet. Be the first to report stock &amp; queue.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {reports.map((report) => {
                  const dot =
                    report.status === 'full'
                      ? 'bg-status-green'
                      : report.status === 'queue'
                      ? 'bg-status-amber'
                      : report.status === 'low'
                      ? 'bg-status-orange'
                      : 'bg-status-red';
                  const verified = Boolean(report.verified && report.isPhotoVerified);
                  return (
                    <div key={report.id} className="flex gap-3 items-start">
                      <div className="relative shrink-0">
                        {report.authorAvatar ? (
                          <img src={report.authorAvatar} alt={report.author} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-surface-container-highest text-slate-600 font-bold flex items-center justify-center text-caption">
                            {report.author.charAt(0)}
                          </div>
                        )}
                        {verified && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary border-2 border-surface text-white flex items-center justify-center"
                            title="Photo verified"
                          >
                            <span className="material-symbols-outlined text-[12px] material-symbols-fill">check</span>
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-caption font-bold text-slate-900 truncate">{report.author}</span>
                          <span className="text-micro text-outline shrink-0">{getFreshnessBadgeInfo(report.timestamp).label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          <span className="text-caption font-bold text-slate-900">
                            {report.statusLabel}
                            {report.waitMinutes ? ` · ${report.waitMinutes}m wait` : ''}
                          </span>
                        </div>
                        {report.comment && (
                          <p className="text-caption text-on-surface-variant mt-1 leading-relaxed">&ldquo;{report.comment}&rdquo;</p>
                        )}
                        {report.photo && (
                          <div
                            onClick={() => setSelectedPhoto(report.photo!)}
                            className="w-32 h-24 rounded-xl overflow-hidden mt-2 cursor-pointer"
                          >
                            <img src={report.photo} alt="Report snapshot" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <button
                          onClick={() => handleVote(report.id, 'up')}
                          aria-label="Helpful"
                          className={`mt-2 flex items-center gap-1 text-micro font-semibold transition-colors ${
                            report.userVoted === 'up' ? 'text-primary' : 'text-outline'
                          }`}
                        >
                          <span
                            className="material-symbols-outlined text-[15px]"
                            style={{ fontVariationSettings: report.userVoted === 'up' ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            thumb_up
                          </span>
                          <span>{report.likes}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsPrimitive.Content>

          {/* TAB CONTENT 3: Station Photos Gallery */}
          <TabsPrimitive.Content value="photos" className="mt-4 outline-none">
            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPhoto(imgUrl)}
                    className="w-full h-32 rounded-2xl overflow-hidden cursor-pointer bg-surface-container"
                  >
                    <img src={imgUrl} alt={`Station photo ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[32px] text-slate-300">photo_camera</span>
                <p className="text-caption text-outline max-w-xs">
                  No photos yet. Only live camera photos taken at the station appear here.
                </p>
              </div>
            )}
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      </div>

      {/* Sticky bottom actions: one primary CTA, two quiet secondaries */}
      <div className="fixed bottom-0 left-0 right-0 bg-white px-5 pt-3 shadow-[0_-6px_18px_rgba(31,41,35,0.08)] z-40 pb-safe">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          <button
            onClick={() => onOpenReportModal(station)}
            className="w-full py-3.5 bg-accent text-white rounded-full font-bold text-body flex items-center justify-center gap-2 shadow-[0_8px_18px_rgba(248,91,35,0.3)] active:scale-[0.98] transition-transform"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Report Status
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                openExternalMaps(station);
                if (onNavigate) onNavigate(station);
              }}
              className="flex-1 py-2.5 rounded-full border-[1.5px] border-surface-container-highest text-slate-900 font-semibold text-caption flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span className="material-symbols-outlined text-[16px]">navigation</span>
              Directions
            </button>
            <button
              onClick={() => openWhatsAppShare(station)}
              className="flex-1 py-2.5 rounded-full border-[1.5px] border-surface-container-highest text-slate-900 font-semibold text-caption flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <span className="material-symbols-outlined text-[16px]">ios_share</span>
              Share
            </button>
          </div>

          {activeTab === 'feed' && (
            <form onSubmit={handlePostGroupComment} className="flex items-center gap-2 pb-1">
              <div className="flex-1 bg-surface-container rounded-full h-10 flex items-center px-4">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Post message to this station…"
                  className="w-full bg-transparent border-none outline-none text-caption text-on-surface placeholder:text-outline"
                />
              </div>
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                aria-label="Post comment to station group"
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-[18px] material-symbols-fill">send</span>
              </button>
            </form>
          )}
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
