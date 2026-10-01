import React, { useEffect, useRef, useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { TabUnderline } from './common/TabUnderline';
import { FlagReportSheet, type FlagReason } from './FlagReportSheet';
import { GasStation, CommentItem, UserProfile, DriverReport } from '../types';
import { ASSETS } from '../data/mockData';
import { openExternalMaps } from '../utils/navigationHelper';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';
import { formatStationAge, formatRelativeTime, isIsoTimestamp, minutesSince } from '../utils/timeUtils';
import { openWhatsAppShare } from '../utils/shareMessageBuilder';
import { describeLocationPrecision } from '../utils/locationPrecision';

// Status-card icon/tile colors per the 2026-10 redesign's 4-status system.
const STATUS_CARD_INFO: Record<string, { icon: string; tileBg: string; tileColor: string }> = {
  full: { icon: 'check_circle', tileBg: 'bg-rd-available-container', tileColor: 'text-rd-on-available-container' },
  queue: { icon: 'schedule', tileBg: 'bg-rd-queuing-container', tileColor: 'text-rd-on-queuing-container' },
  low: { icon: 'speed', tileBg: 'bg-rd-low-container', tileColor: 'text-rd-on-low-container' },
  out: { icon: 'block', tileBg: 'bg-rd-out-container', tileColor: 'text-rd-on-out-container' },
  unknown: { icon: 'history', tileBg: 'bg-surface-container-high', tileColor: 'text-outline' },
};

interface StationDetailScreenProps {
  /** Flag a report (signed-in drivers). Resolve true when it was sent. */
  onFlagReport?: (reportId: string, reason: FlagReason) => Promise<boolean>;
  station: GasStation;
  user?: UserProfile;
  onBack: () => void;
  onOpenReportModal: (station: GasStation) => void;
  onNavigate: (station: GasStation) => void;
  onAddStationComment?: (stationId: string, commentText: string) => void;
  onAddPhoto?: () => void;
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
  onFlagReport,
  onAddStationComment,
  onAddPhoto,
  isPresenceActive = true,
  isFavorite = false,
  onToggleFavorite,
}) => {
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
  const [flaggingReport, setFlaggingReport] = useState<DriverReport | null>(null);
  const [isPresenceActiveState, setIsPresenceActiveState] = useState<boolean>(isPresenceActive);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);
  const [photoFilter, setPhotoFilter] = useState<'all' | 'live'>('all');

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


  const images = station.images || [];
  // Live-verified photos (from stationMedia, backed by real report/timestamp data) vs. the
  // plain listing photo(s) added when the station was suggested — design_handoff_cng_connect_
  // mobile 4b is explicit that these must never look the same ("isn't a status claim").
  // Most recent live photo first, then listing photos.
  const photoItems: { key: string; url: string; isLive: boolean; timestamp?: string }[] = [
    ...(station.stationMedia || [])
      .filter((m) => m.isVerified && m.mediaUrl)
      .map((m) => ({ key: m.id, url: m.mediaUrl, isLive: true, timestamp: m.photoTimestamp })),
    ...images.map((url, idx) => ({ key: `listing-${idx}`, url, isLive: false, timestamp: undefined })),
  ].sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    const at = a.timestamp && isIsoTimestamp(a.timestamp) ? new Date(a.timestamp).getTime() : 0;
    const bt = b.timestamp && isIsoTimestamp(b.timestamp) ? new Date(b.timestamp).getTime() : 0;
    return bt - at;
  });
  const livePhotoCount = photoItems.filter((p) => p.isLive).length;

  // Viewer's local time labeled "WAT" — this app is Nigeria-only, so that's correct for
  // nearly everyone; not a true timezone conversion.
  const formatPhotoTimestamp = (iso?: string): string | null => {
    if (!iso || !isIsoTimestamp(iso)) return null;
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${d.getFullYear()} · ${hh}:${mm} WAT`;
  };
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
          text: `Join ${station.name} Station Group on CNG-Connect! Status: ${station.statusLabel}.`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(
          `${station.name} Station Group (${station.address}): Status: ${station.statusLabel}`
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
    // data-theme="light": this screen is being rebuilt to design_handoff_cng_connect_mobile,
    // which has no dark-mode values defined yet (same reasoning as MapScreen's mobile UI) —
    // forcing light here avoids a half-light/half-dark mix between the new literal bg-white/
    // rd-ink classes and the semantic tokens that still flip dark.
    <div data-theme="light" className="min-h-screen bg-surface text-on-surface pb-36">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-white text-[0.875rem] font-bold px-4 py-2 rounded-full shadow-lg">
          Station Group link copied!
        </div>
      )}

      {/* Hero photo with floating actions — redesign (design_handoff_cng_connect_mobile 3c):
          44pt translucent round buttons, a "Photos · n" badge instead of the old
          distance/drivetime overlay (that info moves into the eyebrow line below). */}
      <div className="relative h-[250px] md:h-96 w-full bg-slate-900 overflow-hidden md:max-w-4xl md:mx-auto md:rounded-b-3xl">
        <img src={images?.[0] || ASSETS.stationWide} alt={station.name} className="w-full h-full object-cover" />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
        <button
          onClick={onBack}
          aria-label="Go back"
          className="absolute top-[max(env(safe-area-inset-top,0px),1rem)] left-4 w-11 h-11 rounded-full bg-white/80 backdrop-blur-sm text-rd-ink flex items-center justify-center active:scale-95 transition-transform"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="absolute top-[max(env(safe-area-inset-top,0px),1rem)] right-4 flex gap-2">
          <button
            onClick={() => onToggleFavorite?.(station.id)}
            aria-label={isFavorite ? 'Remove from favorite stations' : 'Add to favorite stations'}
            className={`w-11 h-11 rounded-full backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform ${
              isFavorite ? 'bg-white/80 text-status-red' : 'bg-white/80 text-rd-ink'
            }`}
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${isFavorite ? 'material-symbols-fill' : ''}`}>
              favorite
            </span>
          </button>
          <button
            onClick={handleShareStation}
            aria-label="Share Station Group"
            className="w-11 h-11 rounded-full bg-white/80 backdrop-blur-sm text-rd-ink flex items-center justify-center active:scale-95 transition-transform"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">ios_share</span>
          </button>
        </div>
        {images.length > 0 && (
          <span className="absolute bottom-3 left-4 inline-flex items-center gap-1 rounded-lg bg-rd-ink/80 text-white text-[0.75rem] font-semibold px-2 py-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[14px]">photo_camera</span>
            Photos · {images.length}
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-5 pt-4 flex flex-col gap-5">
        {/* Identity + live status */}
        <div>
          <p className="font-geist-mono text-[11px] font-medium tracking-[0.08em] uppercase text-rd-text-tertiary">
            {[
              station.stationType === 'ev_charging' ? 'EV charging' : 'CNG station',
              station.distance,
              station.driveTime || null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <h1
            onClick={() => setShowFullTitle(!showFullTitle)}
            title={station.name}
            className={`font-geist text-[1.625rem] font-bold text-rd-ink tracking-tight leading-tight cursor-pointer mt-0.5 ${
              showFullTitle ? '' : 'truncate'
            }`}
          >
            {station.name}
          </h1>
          <p className="text-caption text-outline mt-1 flex items-center gap-1 min-w-0">
            <span className="truncate">{station.address}</span>
            <button
              onClick={() => setShowInfoSheet(true)}
              className="shrink-0 text-outline/70 hover:text-outline"
              aria-label="Station group guidelines"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[15px]">info</span>
            </button>
          </p>
          {describeLocationPrecision(station) && (
            <p className="text-micro font-medium text-[#B5380A] mt-1">
              {describeLocationPrecision(station)}
            </p>
          )}
          {presenceCount > 0 && (
            <span className="mt-2 flex items-center gap-1.5 text-micro font-semibold text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-live-pulse animate-pulse" />
              {presenceCount} here now
            </span>
          )}
        </div>

        {/* Status card (design_handoff_cng_connect_mobile 3c): icon tile + title + freshness,
            plus a report-incentive prompt strip when there's no report today. Simplified from
            the handoff's "Last: Full stock, 15 min wait · 17 Sep" line — reconstructing the
            true last-known report (vs. today's aggregate status) needs new history-lookup logic
            this pass doesn't add; see the age line used elsewhere in the app instead. */}
        {station.stationType !== 'ev_charging' &&
          (() => {
            const cardInfo = STATUS_CARD_INFO[station.status] || STATUS_CARD_INFO.unknown;
            const isUnknown = station.status === 'unknown';
            return (
              <div className="flex flex-col gap-3">
                <div className="rounded-[22px] bg-white shadow-[0_1px_2px_rgba(20,32,26,0.05),0_8px_24px_rgba(20,32,26,0.05)] p-4 flex items-center gap-3">
                  <span className={`w-[46px] h-[46px] rounded-2xl flex items-center justify-center shrink-0 ${cardInfo.tileBg} ${cardInfo.tileColor}`}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[22px]">{cardInfo.icon}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-geist font-bold text-[1.25rem] text-rd-ink leading-tight truncate">
                      {isUnknown ? 'No report today' : getFormattedStatusPillText(station)}
                    </p>
                    <p className="text-caption text-rd-text-tertiary mt-0.5">
                      {isUnknown
                        ? 'Be the first to tell drivers if this station has gas.'
                        : formatStationAge(station)}
                    </p>
                  </div>
                </div>
                {isUnknown && (
                  <div className="rounded-2xl bg-rd-available-container px-4 py-3 flex items-center gap-3">
                    <span aria-hidden="true" className="material-symbols-outlined text-rd-on-available-container text-[20px] shrink-0">bolt</span>
                    <p className="flex-1 text-caption font-semibold text-rd-on-available-container">
                      At the station? Be the first to report today.
                    </p>
                    <span className="shrink-0 text-[0.75rem] font-bold text-rd-on-available-container">+10 pts</span>
                  </div>
                )}
              </div>
            );
          })()}

        {/* Key numbers (EV only — CNG's equivalent is the status card above) */}
        {station.stationType === 'ev_charging' && (
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="text-[0.75rem] font-bold text-outline uppercase tracking-wider">Rate</div>
              <div className={`font-extrabold mt-1 ${station.pricePerKwh ? 'text-heading text-slate-900' : 'text-body-lg text-slate-400'}`}>
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
        )}

        {/* Radix Accessible 3-Way Tabs Switcher */}
        <TabsPrimitive.Root value={activeTab} onValueChange={(val) => setActiveTab(val as 'feed' | 'reports' | 'photos')} className="w-full">
          <TabsPrimitive.List ref={tabListRef} className="relative flex gap-6 border-b border-surface-container-highest">
            <TabsPrimitive.Trigger
              value="reports"
              className="pb-2.5 -mb-px font-geist text-[0.9375rem] font-semibold text-rd-text-tertiary border-b-2 border-transparent transition-colors data-[state=active]:text-rd-ink data-[state=active]:font-bold focus:outline-none"
            >
              Reports{reports.length > 0 ? ` · ${reports.length}` : ''}
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger
              value="feed"
              className="pb-2.5 -mb-px font-geist text-[0.9375rem] font-semibold text-rd-text-tertiary border-b-2 border-transparent transition-colors data-[state=active]:text-rd-ink data-[state=active]:font-bold focus:outline-none"
            >
              Chat{comments.length > 0 ? ` · ${comments.length}` : ''}
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger
              value="photos"
              className="pb-2.5 -mb-px font-geist text-[0.9375rem] font-semibold text-rd-text-tertiary border-b-2 border-transparent transition-colors data-[state=active]:text-rd-ink data-[state=active]:font-bold focus:outline-none"
            >
              Photos{images.length > 0 ? ` · ${images.length}` : ''}
            </TabsPrimitive.Trigger>
            <TabUnderline listRef={tabListRef} active={activeTab} deps={[comments.length, reports.length, images.length]} />
          </TabsPrimitive.List>

          {/* TAB CONTENT 1: Station Group Chat Feed & Discussion — message bubbles per
              design_handoff_cng_connect_mobile 4a. "Mine" is inferred by matching the
              author name (CommentItem has no author-id field to compare against instead),
              which is good enough for bubble alignment but not a security boundary. Status
              reports are NOT merged into this timeline — they stay on the separate Reports
              tab, since merging would be a bigger behavior change than a visual rebuild. */}
          <TabsPrimitive.Content value="feed" className="mt-4 outline-none">
            {comments.length === 0 ? (
              <p className="text-caption text-outline py-6 text-center">No messages yet. Say hi to drivers here.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((comment) => {
                  const mine = Boolean(user?.name) && comment.author === user?.name;
                  return (
                    <div key={comment.id} className={`flex gap-2.5 items-end ${mine ? 'flex-row-reverse' : ''}`}>
                      {!mine &&
                        (comment.authorAvatar ? (
                          <img src={comment.authorAvatar} alt={comment.author} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-surface-container-highest text-slate-600 font-bold flex items-center justify-center text-micro shrink-0">
                            {comment.author.charAt(0)}
                          </div>
                        ))}
                      <div className={`max-w-[78%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        {!mine && <span className="text-[0.75rem] font-semibold text-rd-text-tertiary mb-0.5 px-1">{comment.author}</span>}
                        <div
                          className={`px-3.5 py-2.5 text-[0.9375rem] leading-relaxed ${
                            mine
                              ? 'bg-primary text-white rounded-[18px] rounded-br-[6px]'
                              : 'bg-white text-rd-ink shadow-[0_1px_2px_rgba(20,32,26,0.05),0_2px_8px_rgba(20,32,26,0.06)] rounded-[18px] rounded-bl-[6px]'
                          }`}
                        >
                          {comment.content}
                        </div>
                        <span className="text-[0.75rem] text-rd-text-tertiary mt-0.5 px-1 flex items-center gap-1">
                          {comment.timeAgo}
                          {mine && <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-primary">done_all</span>}
                        </span>
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="mt-1.5 pl-3 border-l-2 border-surface-container-highest flex flex-col gap-1.5">
                            {comment.replies.map((reply) => (
                              <div key={reply.id}>
                                <span className="text-micro font-bold text-rd-ink">{reply.author}</span>
                                <span className="text-micro text-rd-text-tertiary"> · {reply.timeAgo}</span>
                                <p className="text-caption text-on-surface-variant">{reply.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                  const freshness = getFreshnessBadgeInfo(report.timestamp);
                  return (
                    <div key={report.id} className="flex gap-3 items-start">
                      <div className="relative shrink-0">
                        {report.authorAvatar ? (
                          <img src={report.authorAvatar} alt={report.author} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-surface-container-highest text-slate-600 font-bold flex items-center justify-center text-caption">
                            {report.author.charAt(0)}
                          </div>
                        )}
                        {verified && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary border-2 border-surface text-white flex items-center justify-center"
                            title="Photo verified"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-[12px] material-symbols-fill">check</span>
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-geist text-[0.9375rem] font-semibold text-rd-ink truncate">{report.author}</span>
                          <span className="shrink-0 inline-flex items-center rounded-md bg-surface-container-high px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-rd-text-tertiary">
                            {freshness.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          <span className="text-caption font-bold text-rd-ink">
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
                        <div className="mt-2 flex items-center justify-between">
                        <button
                          onClick={() => handleVote(report.id, 'up')}
                          aria-label="Helpful"
                          className={`flex items-center gap-1 text-micro font-semibold transition-colors ${
                            report.userVoted === 'up' ? 'text-primary' : 'text-outline'
                          }`}
                        >
                          <span aria-hidden="true"
                            className="material-symbols-outlined text-[15px]"
                            style={{ fontVariationSettings: report.userVoted === 'up' ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            thumb_up
                          </span>
                          <span>{report.likes}</span>
                        </button>
                        {onFlagReport && (
                          <button
                            onClick={() => setFlaggingReport(report)}
                            aria-label={`Report a problem with ${report.author}'s report`}
                            className="flex items-center gap-1 text-micro font-semibold text-outline hover:text-rd-ink transition-colors"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined text-[15px]">flag</span>
                            <span>Report</span>
                          </button>
                        )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsPrimitive.Content>

          {/* TAB CONTENT 3: Station Photos Gallery — featured latest + grid, per
              design_handoff_cng_connect_mobile 4b. Live-verified vs. listing photos are
              visually distinct (green "Live" badge vs. white "Station listing" badge) so
              the listing photo never reads as proof of current status. */}
          <TabsPrimitive.Content value="photos" className="mt-4 outline-none">
            {photoItems.length > 0 ? (
              <>
                <div role="tablist" aria-label="Filter photos" className="flex gap-1.5 mb-3.5">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={photoFilter === 'all'}
                    onClick={() => setPhotoFilter('all')}
                    className={`rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                      photoFilter === 'all' ? 'bg-rd-ink text-white' : 'bg-rd-chip-grey text-rd-ink'
                    }`}
                  >
                    All {photoItems.length}
                  </button>
                  {livePhotoCount > 0 && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={photoFilter === 'live'}
                      onClick={() => setPhotoFilter('live')}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                        photoFilter === 'live' ? 'bg-rd-ink text-white' : 'bg-rd-chip-grey text-rd-available'
                      }`}
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">photo_camera</span>
                      Live verified {livePhotoCount}
                    </button>
                  )}
                </div>

                {(() => {
                  const visible = photoFilter === 'live' ? photoItems.filter((p) => p.isLive) : photoItems;
                  const [featured, ...rest] = visible;
                  if (!featured) {
                    return <p className="text-caption text-outline py-6 text-center">No live-verified photos yet.</p>;
                  }
                  const featuredTime = formatPhotoTimestamp(featured.timestamp);
                  return (
                    <>
                      <div
                        onClick={() => setSelectedPhoto(featured.url)}
                        className="relative w-full h-[220px] rounded-[20px] overflow-hidden cursor-pointer bg-surface-container"
                      >
                        <img src={featured.url} alt="Latest station photo" className="w-full h-full object-cover" />
                        {featured.isLive && (
                          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-md bg-rd-available text-white text-[0.75rem] font-bold px-2 py-1">
                            <span aria-hidden="true" className="material-symbols-outlined text-[13px] material-symbols-fill">verified</span>
                            Live verified
                          </span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-3">
                          <span className="text-white font-geist font-bold text-[0.9375rem] truncate">{station.name}</span>
                          {featuredTime ? (
                            <span className="font-geist-mono text-[11px] text-white/80 mt-0.5">{featuredTime}</span>
                          ) : (
                            <span className="text-[0.75rem] text-white/80 mt-0.5">Station listing photo</span>
                          )}
                        </div>
                      </div>

                      {rest.length > 0 && (
                        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                          {rest.map((item) => (
                            <div
                              key={item.key}
                              onClick={() => setSelectedPhoto(item.url)}
                              className="relative w-full h-[150px] rounded-[18px] overflow-hidden cursor-pointer bg-surface-container"
                            >
                              <img src={item.url} alt="Station photo" className="w-full h-full object-cover" />
                              <span
                                className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-md text-[0.6875rem] font-bold px-1.5 py-0.5 ${
                                  item.isLive ? 'bg-rd-available text-white' : 'bg-white text-rd-ink'
                                }`}
                              >
                                {item.isLive ? 'Live' : 'Station listing'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}

                <p className="text-[0.75rem] text-rd-text-tertiary leading-relaxed mt-3.5">
                  Live photos carry a burned-in timestamp. The listing photo was added when the
                  station was suggested and isn&apos;t a status claim.
                </p>

                {onAddPhoto && (
                  <div className="mt-3.5 flex flex-col items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onAddPhoto}
                      className="inline-flex items-center gap-2 rounded-full bg-primary text-white font-geist font-bold text-[0.9375rem] px-5 py-3 active:scale-95 transition-transform"
                    >
                      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">add_a_photo</span>
                      Add live photo
                      <span className="text-[0.75rem] font-bold bg-white/20 rounded-full px-2 py-0.5">+15 pts</span>
                    </button>
                    <span className="text-[0.75rem] text-rd-text-tertiary">Camera only · gallery uploads blocked</span>
                  </div>
                )}
              </>
            ) : (
              <div className="py-6 text-center flex flex-col items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-slate-300">photo_camera</span>
                <p className="text-caption text-outline max-w-xs">
                  No photos yet. Only live camera photos taken at the station appear here.
                </p>
              </div>
            )}
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      </div>

      {/* Sticky bottom actions: one primary CTA, two quiet secondaries */}
      <div className="fixed bottom-0 left-0 right-0 bg-white px-5 pt-3 shadow-[0_-10px_30px_rgba(20,32,26,0.12)] z-40 pb-safe">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          {activeTab === 'feed' && (
            <>
              {/* Nudge banner: pushes reporting over chatting, per design_handoff_cng_connect_mobile 4a */}
              <div className="rounded-2xl bg-rd-available-container px-3.5 py-2.5 flex items-center gap-2.5">
                <span aria-hidden="true" className="material-symbols-outlined text-rd-on-available-container text-[18px] shrink-0">campaign</span>
                <p className="flex-1 text-[0.8125rem] font-semibold text-rd-on-available-container leading-snug">
                  At the pump? A status report reaches more drivers than a message.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenReportModal(station)}
                  className="shrink-0 rounded-full bg-primary text-white text-[0.75rem] font-bold px-3 py-1.5 active:scale-95 transition-transform"
                >
                  Report
                </button>
              </div>
              <form onSubmit={handlePostGroupComment} className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-surface-container rounded-full h-[46px] flex items-center px-4">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Message drivers at this station"
                    aria-label="Message to this station's group"
                    className="w-full bg-transparent border-none outline-none text-caption text-on-surface placeholder:text-outline"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  aria-label="Post comment to station group"
                  className="w-[46px] h-[46px] rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shrink-0"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px] material-symbols-fill">send</span>
                </button>
              </form>
            </>
          )}

          <div className="flex items-center gap-2 pb-1">
            <button
              onClick={() => {
                openExternalMaps(station);
                if (onNavigate) onNavigate(station);
              }}
              aria-label="Directions"
              title="Directions"
              className="w-14 h-14 rounded-full bg-surface-container text-rd-ink flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[24px]">navigation</span>
            </button>
            <button
              onClick={() => onOpenReportModal(station)}
              className="flex-1 h-14 bg-rd-ink text-white rounded-full font-geist font-bold text-body flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">campaign</span>
              Report status
            </button>
            <button
              onClick={() => openWhatsAppShare(station)}
              aria-label="Share station on WhatsApp"
              title="Share on WhatsApp"
              className="w-14 h-14 rounded-full bg-surface-container text-rd-ink flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">ios_share</span>
            </button>
          </div>
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
              <span aria-hidden="true" className="material-symbols-outlined text-[32px]">close</span>
            </button>
            <img
              src={selectedPhoto}
              alt="Station View"
              className="w-full h-auto max-h-[75vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {flaggingReport && onFlagReport && (
        <FlagReportSheet
          authorName={flaggingReport.author}
          onClose={() => setFlaggingReport(null)}
          onSubmit={(reason) => onFlagReport(flaggingReport.id, reason)}
        />
      )}

      <StationGroupInfoSheet
        isOpen={showInfoSheet}
        onClose={() => setShowInfoSheet(false)}
      />
    </div>
  );
};
