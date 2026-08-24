import React, { useEffect, useRef, useState } from 'react';
import { GasStation, CommentItem, UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import { openExternalMaps } from '../utils/navigationHelper';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';

interface StationDetailScreenProps {
  station: GasStation;
  user?: UserProfile;
  onBack: () => void;
  onOpenReportModal: (station: GasStation) => void;
  onNavigate: (station: GasStation) => void;
  onAddStationComment?: (stationId: string, commentText: string) => void;
  onAddPhoto?: () => void;
  isPresenceActive?: boolean;
}

export const StationDetailScreen: React.FC<StationDetailScreenProps> = ({
  station,
  user,
  onBack,
  onOpenReportModal,
  onNavigate,
  onAddStationComment,
  isPresenceActive = true,
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
  const [activeTab, setActiveTab] = useState<'feed' | 'reports' | 'photos'>('feed');
  const [isPresenceActiveState, setIsPresenceActiveState] = useState<boolean>(isPresenceActive);
  const [showInfoSheet, setShowInfoSheet] = useState(false);

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
          text: `Join ${station.name} Station Group on GasFinder! Live CNG Status: ${station.statusLabel}, ₦${station.cngPrice}/kg, Pressure: ${station.pumpPressure} bar.`,
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
    <div className="min-h-screen bg-[#f2fcf5] text-[#141d19] pb-36 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#141d19] text-white text-[13px] font-bold px-4 py-2 rounded-full shadow-lg">
          Station Group link copied!
        </div>
      )}

      {/* Sticky Top Header Navigation Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-xs">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="flex items-center gap-1.5 text-slate-700 font-bold text-[13.5px] hover:text-[#006c50] active:scale-95 transition-all min-h-[44px] min-w-[44px] px-1"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="bg-emerald-50 text-[#006c50] border border-emerald-200 px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${presenceCount > 0 ? 'bg-[#00c853] animate-pulse' : 'bg-slate-300'}`} />
            <span>{presenceCount > 0 ? `${presenceCount} drivers here now` : 'Live presence unavailable'}</span>
          </div>

          <button
            onClick={handleShareStation}
            aria-label="Share Station Group"
            className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-[#006c50] flex items-center justify-center active:scale-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-xl mx-auto px-4 md:px-6 pt-4 flex flex-col gap-4">
        {/* Station Group Header & Title */}
        <div className="bg-white rounded-3xl p-5 border border-[#dbe5de] shadow-xs flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-[#006c50] text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">groups</span>
                  <span>Station Group</span>
                </span>
                <button
                  onClick={() => setShowInfoSheet(true)}
                  aria-label="Station Group Policy Info"
                  className="w-11 h-11 rounded-full bg-emerald-100 hover:bg-emerald-200 text-[#006c50] flex items-center justify-center transition-all active:scale-95 shrink-0"
                  title="Policy Info"
                >
                  <span className="material-symbols-outlined text-[16px]">info</span>
                </button>
                <span className="text-[12px] font-extrabold text-[#006c50] flex items-center gap-1 ml-auto">
                  <span className={`w-1.5 h-1.5 rounded-full ${presenceCount > 0 ? 'bg-[#00c853] animate-pulse' : 'bg-slate-300'}`} />
                  {presenceCount > 0 ? `${presenceCount} Active Nearby` : 'Join the group'}
                </span>
              </div>
              <h1 className="text-[22px] sm:text-[25px] font-extrabold text-slate-900 tracking-tight leading-snug line-clamp-2">
                {station.name}
              </h1>
            </div>
          </div>

          <p className="text-[13.5px] font-normal text-slate-600 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">
              location_on
            </span>
            <span>{station.address}</span>
          </p>

          {/* Live Status & Specs Summary */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#dbe5de]/70">
            {/* Status Badge */}
            <div
              className={`rounded-full px-3 py-1 flex items-center gap-1.5 shadow-2xs ${
                station.status === 'full'
                  ? 'bg-[#00E676] text-white font-bold'
                  : station.status === 'low'
                  ? 'bg-[#fe9400] text-white font-bold'
                  : station.status === 'queue'
                  ? 'bg-[#FFB800] text-[#141d19] font-bold'
                  : 'bg-[#6a7b72] text-white font-bold'
              }`}
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {station.status === 'full'
                  ? 'check_circle'
                  : station.status === 'queue'
                  ? 'schedule'
                  : station.status === 'low'
                  ? 'battery_3_bar'
                  : 'not_interested'}
              </span>
              <span className="text-[11.5px] tracking-wider uppercase font-extrabold">
                {station.statusLabel}
              </span>
            </div>

            {/* Busy Status */}
            <div className="bg-[#ffe149]/30 border border-[#FFB800]/60 rounded-full px-3 py-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#746300] text-[15px]">
                schedule
              </span>
              <span className="text-[11.5px] font-semibold text-[#746300]">
                {station.busyEstimate}
              </span>
            </div>

            {/* Time / Distance Info */}
            <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 ml-auto">
              <span className="flex items-center gap-1 text-[#006c50] font-semibold">
                Updated {station.lastUpdated}
              </span>
            </div>
          </div>
        </div>

        {/* Station Image Banner with Distance Badge */}
        <div className="relative rounded-2xl overflow-hidden shadow-xs border border-[#dbe5de] h-36 bg-[#e6f0e9]">
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url('${images[1] || images?.[0]}')` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-4">
              <div className="flex items-center justify-between w-full">
                <span className="bg-black/60 backdrop-blur-md text-white text-[12px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="material-symbols-outlined text-[16px] text-[#00E676]">near_me</span>
                  <span>{station.distance} • {station.driveTime}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Price & Pump Pressure Bento Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-[#dbe5de] shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              CNG Price
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-[28px] font-bold text-[#004D40]">
                ₦{station.cngPrice}
              </span>
              <span className="text-[13px] font-normal text-slate-400">/kg</span>
            </div>
            <span className="text-[11px] font-semibold text-[#00E676] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
              <span>{station.priceTrend === 'stable' ? 'Official Rate' : 'Updated'}</span>
            </span>
          </div>

          {/* Interactive 220-Bar SVG Pump Pressure Arc Gauge Bento Card */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#dbe5de] shadow-xs flex flex-col justify-between relative overflow-hidden group">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Pump Pressure
              </span>
              <span
                className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full border ${
                  station.pumpPressure >= 180
                    ? 'bg-emerald-50 text-[#006c50] border-emerald-200'
                    : station.pumpPressure >= 130
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                {station.pumpPressure >= 180 ? 'Optimal' : station.pumpPressure >= 130 ? 'Moderate' : 'Low'}
              </span>
            </div>

            {/* SVG Arc Gauge */}
            <div className="relative flex flex-col items-center justify-center my-0.5">
              <svg viewBox="0 0 100 55" className="w-28 h-16 transform transition-transform group-hover:scale-105">
                {/* Background Track Arc */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#e6f0e9"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                {/* Gauge Colored Arc */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke={
                    station.pumpPressure >= 180
                      ? '#00c853'
                      : station.pumpPressure >= 130
                      ? '#fe9400'
                      : '#ba1a1a'
                  }
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray="125.6"
                  strokeDashoffset={125.6 * (1 - Math.min(station.pumpPressure, 220) / 220)}
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              <div className="absolute bottom-0 flex flex-col items-center text-center -mb-1">
                <span className="text-[20px] font-extrabold leading-none text-slate-900">
                  {station.pumpPressure}
                </span>
                <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-widest -mt-0.5">
                  bar
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pt-1 border-t border-slate-100">
              <span>0 bar</span>
              <span className="text-[#006c50] font-semibold">{Math.round((station.pumpPressure / 220) * 100)}% Max</span>
              <span>220 bar</span>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Group Feed vs Verified Reports vs Photos */}
        <div className="flex bg-[#e6f0e9] p-1 rounded-2xl border border-[#dbe5de]">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-2.5 rounded-xl text-[12.5px] font-bold transition-all text-center ${
              activeTab === 'feed'
                ? 'bg-white text-[#006c50] shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="whitespace-nowrap">Group Chat ({comments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-2.5 rounded-xl text-[12.5px] font-bold transition-all text-center ${
              activeTab === 'reports'
                ? 'bg-white text-[#006c50] shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="whitespace-nowrap">Driver Reports ({reports.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className={`flex-1 py-2.5 rounded-xl text-[12.5px] font-bold transition-all text-center ${
              activeTab === 'photos'
                ? 'bg-white text-[#006c50] shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="whitespace-nowrap">Photos ({images.length})</span>
          </button>
        </div>

        {/* TAB CONTENT 1: Station Group Chat Feed & Discussion */}
        {activeTab === 'feed' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[16px] font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c50] text-[20px]">
                  chat_bubble
                </span>
                <span>Group Discussion Feed</span>
              </h2>
              <span className="text-[11.5px] font-semibold text-[#006c50] bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Open Group Chat
              </span>
            </div>

            {/* Comments List */}
            <div className="flex flex-col gap-3">
              {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-white rounded-2xl p-4 border border-[#dbe5de] shadow-xs flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {comment.authorAvatar ? (
                          <img
                            src={comment.authorAvatar}
                            alt={comment.author}
                            className="w-9 h-9 rounded-full object-cover border border-[#dbe5de]"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#006c50]/20 text-[#006c50] font-bold flex items-center justify-center text-[14px]">
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
                      <div className="mt-2 ml-4 pl-3 border-l-2 border-[#006c50]/30 flex flex-col gap-2">
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
        )}

        {/* TAB CONTENT 2: Driver Status Reports */}
        {activeTab === 'reports' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[17px] font-bold text-[#141d19] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006c50] text-[20px]">
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
                    className="bg-white rounded-2xl p-4 border border-[#dbe5de] shadow-xs flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {report.authorAvatar ? (
                          <img
                            src={report.authorAvatar}
                            alt={report.author}
                            className="w-10 h-10 rounded-full object-cover border border-[#dbe5de] shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#fe9400]/20 text-[#8c5000] font-bold flex items-center justify-center text-[16px] shrink-0">
                            {report.author.charAt(0)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="text-[14px] font-bold text-[#141d19] truncate">
                            {report.author}
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
                        <div className="bg-emerald-100 border border-emerald-300 text-[#006c50] px-2.5 py-1 rounded-full text-[10.5px] font-semibold flex items-center gap-1 shadow-2xs shrink-0 whitespace-nowrap">
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
                          ? 'bg-[#006c50]'
                          : report.status === 'low'
                          ? 'bg-[#fe9400]'
                          : report.status === 'queue'
                          ? 'bg-[#FFB800]'
                          : 'bg-[#ba1a1a]'
                      }`}
                    />
                    <span className="text-[13.5px] font-bold text-[#141d19]">
                      {report.statusLabel}{' '}
                      {report.waitMinutes ? `(${report.waitMinutes}m wait)` : ''}
                    </span>
                  </div>

                  {report.comment && (
                    <p className="text-[14px] font-normal text-[#3a4a43] leading-relaxed">
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
                      className="w-32 h-24 rounded-lg overflow-hidden border border-[#dbe5de] mt-1 cursor-pointer"
                    >
                      <img
                        src={report.photo}
                        alt="Report snapshot"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Actions (Like / Dislike) */}
                  <div className="flex items-center gap-3 pt-2 border-t border-[#dbe5de]/50 mt-1">
                    <button
                      onClick={() => handleVote(report.id, 'up')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold transition-all ${
                        report.userVoted === 'up'
                          ? 'bg-[#006c50] text-white'
                          : 'bg-[#f2fcf5] text-[#3a4a43] hover:bg-[#e6f0e9]'
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
                          ? 'bg-[#ba1a1a] text-white'
                          : 'bg-[#f2fcf5] text-[#3a4a43] hover:bg-[#e6f0e9]'
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
        )}

        {/* TAB CONTENT 3: Station Photos Gallery */}
        {activeTab === 'photos' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-[17px] font-bold text-[#141d19]">
                Station &amp; Pump Photos ({images.length})
              </h2>
              <button
                onClick={() => onOpenReportModal(station)}
                className="text-[12.5px] font-semibold text-[#006c50] flex items-center gap-1 hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                <span>Add Photo</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {images.map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedPhoto(imgUrl)}
                  className="w-full h-36 rounded-xl overflow-hidden border border-[#dbe5de] shadow-xs cursor-pointer relative group bg-[#e6f0e9]"
                >
                  <img
                    src={imgUrl}
                    alt={`Station photo ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action & Group Comment Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-3 px-4 border-t border-[#dbe5de] shadow-lg z-40 pb-safe">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          {/* Main Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenReportModal(station)}
              className="flex-1 h-12 bg-[#006c50] hover:bg-[#004D40] text-white font-bold text-[13.5px] rounded-full flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-all px-3 min-w-0"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0">
                edit_document
              </span>
              <span className="whitespace-nowrap truncate">Update Status</span>
            </button>

            <button
              onClick={() => {
                openExternalMaps(station);
                if (onNavigate) {
                  onNavigate(station);
                }
              }}
              className="px-3.5 h-12 bg-white text-[#006c50] border-2 border-[#006c50] hover:bg-[#e6f0e9] font-bold text-[13px] rounded-full flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-all shrink-0"
            >
              <span
                className="material-symbols-outlined text-[18px] shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                navigation
              </span>
              <span className="whitespace-nowrap">Get Directions</span>
              <span className="bg-emerald-100 text-[#006c50] text-[10.5px] font-bold px-2 py-0.5 rounded-full ml-0.5 shrink-0">
                {station.distance}
              </span>
            </button>
          </div>

          {/* Station Group Comment Input (Open to All Drivers) */}
          <form onSubmit={handlePostGroupComment} className="flex items-center gap-2 pt-1">
            <div className="flex-1 bg-[#e6f0e9] rounded-full h-11 flex items-center px-4 border border-[#dbe5de]">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={`Post message to ${station.name} Group...`}
                className="w-full bg-transparent border-none outline-none text-[13.5px] text-[#141d19] placeholder:text-[#6a7b72]"
              />
            </div>
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              aria-label="Post comment to station group"
              className="w-11 h-11 rounded-full bg-[#006c50] text-white flex items-center justify-center shadow-sm hover:bg-[#004D40] disabled:opacity-40 transition-all active:scale-95 shrink-0"
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
    </div>
  );
};
