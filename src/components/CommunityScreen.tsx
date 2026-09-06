import React, { useEffect, useRef, useState } from 'react';
import { CommunityPost, GasStation } from '../types';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';
import { EmptyState } from './common/EmptyState';
import type { LeaderboardDriver } from '../utils/reputationEngine';
import { apiService } from '../services/apiService';
import { isSameState } from '../utils/proximityAlertEngine';

const STATUS_OPTIONS: { id: string; label: string; dotColor?: string }[] = [
  { id: 'all', label: 'All Statuses' },
  { id: 'full', label: 'Full Stock', dotColor: 'bg-status-green' },
  { id: 'queue', label: 'Queuing', dotColor: 'bg-status-orange' },
  { id: 'low', label: 'Low Pressure', dotColor: 'bg-status-orange' },
  { id: 'out', label: 'Out of Gas', dotColor: 'bg-status-red' },
];

interface CommunityScreenProps {
  posts: CommunityPost[];
  stations?: GasStation[];
  /** Driver's registered state — station groups default to it until the
   *  driver searches, which widens to every station group nationwide. */
  homeState?: string;
  onOpenDiscussion: (post: CommunityPost) => void;
  onOpenChat: (post: CommunityPost) => void;
  onOpenCreatePost: () => void;
  onOpenStationGroup?: (station: GasStation) => void;
  onOpenNotifications?: () => void;
  onToggleLikePost?: (postId: string) => void;
  onOpenConversions?: () => void;
}

export const CommunityScreen: React.FC<CommunityScreenProps> = ({
  posts,
  stations = [],
  homeState,
  onOpenDiscussion,
  onOpenChat,
  onOpenCreatePost,
  onOpenStationGroup,
  onOpenNotifications,
  onToggleLikePost,
  onOpenConversions,
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'station_groups' | 'general' | 'leaderboard'>('station_groups');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Local like-state overlay keyed by post id; the post list itself stays in
  // sync with the parent's `posts` prop so newly created posts appear live.
  const [likeOverrides, setLikeOverrides] = useState<Record<string, { isLiked: boolean; likes: number }>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardDriver[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiService.fetchLeaderboard().then((rows) => {
      if (active) setLeaderboard(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500);
  };

  const handleToggleLike = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleLikePost) {
      onToggleLikePost(postId);
    }
    setLikeOverrides((prev) => {
      const current = prev[postId] || {
        isLiked: Boolean(posts.find((p) => p.id === postId)?.isLiked),
        likes: posts.find((p) => p.id === postId)?.likes || 0,
      };
      return {
        ...prev,
        [postId]: {
          isLiked: !current.isLiked,
          likes: current.isLiked ? Math.max(0, current.likes - 1) : current.likes + 1,
        },
      };
    });
  };

  const handleSharePost = (post: CommunityPost, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator
        .share({
          title: post.title,
          text: `${post.title} by ${post.author} on CNG-Connect Community`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(`"${post.title}" - ${post.content.slice(0, 100)}... on CNG-Connect`)
        .then(() => showToast('Discussion link copied!'))
        .catch(() => showToast('Could not copy link on this device.'));
    }
  };

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredPosts = posts.filter((p) => {
    const matchesCategory =
      activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const scopedStationGroups =
    homeState && !searchQuery.trim()
      ? (() => {
          const inHome = stations.filter((st) => isSameState(st.state, homeState));
          return inHome.length > 0 ? inHome : stations;
        })()
      : stations;

  const filteredStations = scopedStationGroups.filter((st) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      st.name.toLowerCase().includes(q) ||
      st.city.toLowerCase().includes(q) ||
      st.state.toLowerCase().includes(q) ||
      st.address.toLowerCase().includes(q) ||
      (st.operator && st.operator.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || st.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-28 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface/90 text-white text-body font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      {/* Sticky Top Bar: Main Segment Control + Search */}
      <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md py-2.5 px-4 md:px-6 border-b border-surface-container-highest/70 max-w-4xl mx-auto flex flex-col gap-2">
        {/* Main Section Tab Switcher */}
        <div className="flex bg-surface-container p-1 rounded-2xl border border-surface-container-highest">
          <button
            onClick={() => setActiveMainTab('station_groups')}
            className={`flex-1 py-2.5 rounded-xl text-body font-bold transition-all text-center ${
              activeMainTab === 'station_groups'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="whitespace-nowrap">Station Groups ({stations.length})</span>
          </button>

          <button
            onClick={() => setActiveMainTab('general')}
            className={`flex-1 py-2.5 rounded-xl text-body font-bold transition-all text-center ${
              activeMainTab === 'general'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="whitespace-nowrap">General Hub</span>
          </button>

          <button
            onClick={() => setActiveMainTab('leaderboard')}
            className={`flex-1 py-2.5 rounded-xl text-body font-bold transition-all text-center flex items-center justify-center gap-1 ${
              activeMainTab === 'leaderboard'
                ? 'bg-[#004D40] text-[#00FFC2] shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>🏆 Legends</span>
          </button>
        </div>

        {/* Search Bar & Notification Button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeMainTab === 'station_groups'
                  ? 'Search station groups, city, state...'
                  : 'Search tips, station updates, deals...'
              }
              className="w-full bg-surface-container border border-surface-container-highest/70 rounded-full py-2 pl-10 pr-9 text-body font-normal text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-on-surface rounded-full shrink-0"
                aria-label="Clear search query"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <button
            onClick={() => {
              if (onOpenNotifications) {
                onOpenNotifications();
              } else {
                setToastMessage('Notifications panel coming soon');
                setTimeout(() => setToastMessage(null), 2500);
              }
            }}
            aria-label="Notifications"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors relative active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">
              notifications
            </span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-white" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-3">
        {/* MAIN TAB 1: Station Groups List & Scoping Notice */}
        {activeMainTab === 'station_groups' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-title font-bold text-on-surface tracking-tight truncate">
                  Station Groups ({filteredStations.length})
                </h2>
                <button
                  onClick={() => setShowInfoSheet(true)}
                  aria-label="Station Group Policy Info"
                  className="w-6 h-6 rounded-full bg-emerald-100 hover:bg-emerald-200 text-primary flex items-center justify-center transition-all active:scale-95 shrink-0"
                  title="Policy Info"
                >
                  <span className="material-symbols-outlined text-[15px]">info</span>
                </button>
              </div>
              {/* Status filter — collapsed into a single control */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowStatusMenu((v) => !v)}
                  aria-label="Filter station groups by status"
                  className={`flex items-center gap-1 text-micro font-semibold px-2 py-1.5 rounded-xl border transition-colors active:scale-95 ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      : 'bg-primary text-white border-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  {statusFilter !== 'all' && (
                    <span className="whitespace-nowrap">
                      {STATUS_OPTIONS.find((o) => o.id === statusFilter)?.label}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[14px]">
                    {showStatusMenu ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {showStatusMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowStatusMenu(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-40 w-44 bg-white rounded-2xl border border-slate-200 shadow-lg py-1 overflow-hidden">
                      {STATUS_OPTIONS.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => {
                            setStatusFilter(o.id);
                            setShowStatusMenu(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-caption font-medium text-left transition-colors ${
                            statusFilter === o.id ? 'bg-emerald-50 text-primary' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${o.dotColor ?? 'bg-transparent'}`} />
                          <span>{o.label}</span>
                          {statusFilter === o.id && (
                            <span className="material-symbols-outlined text-[16px] ml-auto">check</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Station Groups — flat divider rows on mobile, cards from md up */}
            {filteredStations.length === 0 ? (
              <EmptyState
                title="No Station Groups Found"
                message="No station groups match your current search query or status filter."
                actionLabel="Reset Filters"
                onAction={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              />
            ) : (
              <div className="flex flex-col divide-y divide-outline-variant/50 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:divide-y-0">
                {filteredStations.map((st) => {
                  const snippet = st.reports?.[0]?.comment || st.stationNotice || '';
                  return (
                    <div
                      key={st.id}
                      onClick={() => onOpenStationGroup && onOpenStationGroup(st)}
                      className="flex items-center gap-3 py-4 cursor-pointer transition-colors active:bg-surface-container/40 md:bg-white md:p-4 md:rounded-2xl md:border md:border-slate-200/80 md:shadow-2xs md:hover:border-primary/60 md:active:bg-transparent"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-[20px]">groups</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-body font-semibold text-on-surface leading-tight truncate">
                          {st.name} Group
                        </h3>
                        <p className="text-caption text-outline font-medium mt-0.5 truncate">
                          {st.status !== 'unknown' && (
                            <span
                              className={st.status === 'full' ? 'text-primary font-semibold' : 'text-amber-700 font-semibold'}
                            >
                              {st.statusLabel}
                              {'  ·  '}
                            </span>
                          )}
                          {st.city}, {st.state}
                          {snippet ? `  ·  ${snippet}` : ''}
                        </p>
                      </div>

                      <span className="material-symbols-outlined text-[18px] text-outline shrink-0">chevron_right</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeMainTab === 'general' ? (
          /* MAIN TAB 2: General Community Hub (Maintenance, Parts, Deals, Conversions) */
          <div className="flex flex-col gap-4">
            {/* Hub Categories Grid */}
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <h2 className="text-title font-bold text-on-surface tracking-tight">
                  Hub Categories
                </h2>
                {activeCategory !== 'all' && (
                  <button
                    onClick={() => setActiveCategory('all')}
                    className="text-caption font-semibold text-primary hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Pi-CNG Conversion Kit Centers */}
                <div
                  onClick={() => {
                    if (onOpenConversions) {
                      onOpenConversions();
                    } else {
                      setActiveCategory(
                        activeCategory === 'conversions' ? 'all' : 'conversions'
                      );
                    }
                  }}
                  className={`col-span-2 rounded-2xl p-3.5 flex items-center gap-3 transition-all cursor-pointer shadow-xs border active:scale-[0.98] ${
                    activeCategory === 'conversions'
                      ? 'bg-emerald-500/20 border-primary ring-2 ring-primary/20'
                      : 'bg-gradient-to-r from-emerald-50 to-teal-50/60 border-emerald-200/80 hover:border-primary/50'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-deep-teal flex items-center justify-center text-status-green shadow-sm shrink-0">
                    <span className="material-symbols-outlined text-[22px]">
                      build_circle
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-body font-bold text-slate-900 truncate">
                        CNG Kit Conversion Centers
                      </span>
                      <span className="text-micro font-semibold text-primary bg-emerald-100 px-2 py-0.5 rounded-xl">
                        Pi-CNG
                      </span>
                    </div>
                    <p className="text-micro font-normal text-slate-500 truncate">
                      337+ Pi-CNG certified centers nationwide
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-2xs transition-colors shrink-0">
                    <span className="material-symbols-outlined text-[18px]">
                      chevron_right
                    </span>
                  </div>
                </div>

                {/* Maintenance */}
                <div
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === 'maintenance' ? 'all' : 'maintenance'
                    )
                  }
                  className={`rounded-2xl p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs border active:scale-[0.98] ${
                    activeCategory === 'maintenance'
                      ? 'bg-primary-container/30 border-primary ring-2 ring-primary/20'
                      : 'bg-white border-slate-200/80 hover:border-primary/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary-container/30 flex items-center justify-center text-on-primary-container shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">
                      build
                    </span>
                  </div>
                  <span className="text-body font-semibold text-on-surface text-center">
                    Maintenance
                  </span>
                </div>

                {/* Parts & Accessories */}
                <div
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === 'parts' ? 'all' : 'parts'
                    )
                  }
                  className={`rounded-2xl p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs border active:scale-[0.98] ${
                    activeCategory === 'parts'
                      ? 'bg-secondary-container/30 border-secondary-container ring-2 ring-secondary-container/20'
                      : 'bg-white border-slate-200/80 hover:border-secondary-container/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-on-secondary-container shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">
                      settings
                    </span>
                  </div>
                  <span className="text-body font-semibold text-on-surface text-center leading-tight">
                    Parts &amp; Accessories
                  </span>
                </div>

                {/* Reviews */}
                <div
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === 'reviews' ? 'all' : 'reviews'
                    )
                  }
                  className={`rounded-2xl p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs border active:scale-[0.98] ${
                    activeCategory === 'reviews'
                      ? 'bg-tertiary-container/40 border-electric-amber ring-2 ring-electric-amber/20'
                      : 'bg-white border-slate-200/80 hover:border-electric-amber/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-tertiary-container/40 flex items-center justify-center text-on-tertiary-container shadow-xs">
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                  </div>
                  <span className="text-body font-semibold text-on-surface text-center">
                    Reviews
                  </span>
                </div>

                {/* Car Deals */}
                <div
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === 'deals' ? 'all' : 'deals'
                    )
                  }
                  className={`rounded-2xl p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs border active:scale-[0.98] ${
                    activeCategory === 'deals'
                      ? 'bg-electric-amber/30 border-secondary ring-2 ring-secondary/20'
                      : 'bg-white border-slate-200/80 hover:border-electric-amber/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-electric-amber/30 flex items-center justify-center text-[#2d1600] shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">
                      local_offer
                    </span>
                  </div>
                  <span className="text-body font-extrabold text-on-surface text-center">
                    Car Deals
                  </span>
                </div>
              </div>
            </div>

            {/* General Discussions List */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-title font-black text-slate-900 tracking-tight">
                  General Discussions
                </h2>
              </div>

              {filteredPosts.length === 0 ? (
                <EmptyState
                  title={searchQuery ? `No results for "${searchQuery}"` : 'No posts found'}
                  message={
                    searchQuery
                      ? `Try searching for other keywords like "pressure", "kit", "NIPCO", or "maintenance".`
                      : activeCategory !== 'all'
                      ? `There are no posts in the ${activeCategory} category yet.`
                      : 'Be the first to share an update or question in the Community hub!'
                  }
                  actionLabel={searchQuery || activeCategory !== 'all' ? 'Clear Search & Filters' : undefined}
                  onAction={
                    searchQuery || activeCategory !== 'all'
                      ? () => {
                          setSearchQuery('');
                          setActiveCategory('all');
                        }
                      : undefined
                  }
                />
              ) : (
                filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => onOpenDiscussion(post)}
                    className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/70 flex flex-col gap-3 relative overflow-hidden group hover:border-primary/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {post.authorAvatar ? (
                        <img
                          src={post.authorAvatar}
                          alt={post.author}
                          className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/20"
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-body ${
                            post.authorInitialBg || 'bg-secondary-container text-white'
                          }`}
                        >
                          {post.authorInitial || post.author.charAt(0)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-body font-semibold text-slate-900 truncate">
                            {post.author}
                          </h3>
                          <span className="text-micro font-medium text-slate-400 shrink-0">
                            {post.timeAgo}
                          </span>
                        </div>
                        <span className="text-micro font-semibold text-outline uppercase tracking-wide">
                          {post.categoryLabel || post.category}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-body-lg font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors leading-snug">
                        {post.title}
                      </h4>
                      <p className="text-body font-medium text-slate-600 line-clamp-3 leading-relaxed">
                        {post.content}
                      </p>
                    </div>

                    {post.image && (
                      <div className="w-full h-36 rounded-2xl bg-slate-100 overflow-hidden relative">
                        <img
                          src={post.image}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-2.5 border-t border-slate-100">
                      <button
                        onClick={(e) => handleToggleLike(post.id, e)}
                        aria-pressed={likeOverrides[post.id]?.isLiked ?? Boolean(post.isLiked)}
                        className={`flex items-center gap-1.5 text-caption font-extrabold transition-all active:scale-95 ${
                          (likeOverrides[post.id]?.isLiked ?? Boolean(post.isLiked))
                            ? 'text-primary'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[19px]"
                          style={{
                            fontVariationSettings: (likeOverrides[post.id]?.isLiked ?? Boolean(post.isLiked))
                              ? "'FILL' 1"
                              : "'FILL' 0",
                          }}
                        >
                          thumb_up
                        </span>
                        <span>{likeOverrides[post.id]?.likes ?? post.likes}</span>
                      </button>

                      <button
                        onClick={() => onOpenDiscussion(post)}
                        className="flex items-center gap-1.5 text-caption font-extrabold text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[19px]">
                          chat_bubble
                        </span>
                        <span>
                          {post.repliesCount}{' '}
                          {post.repliesCount === 1 ? 'Reply' : 'Replies'}
                        </span>
                      </button>

                      <button
                        onClick={(e) => handleSharePost(post, e)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors ml-auto p-1"
                      >
                        <span className="material-symbols-outlined text-[19px]">
                          share
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeMainTab === 'leaderboard' ? (
          /* MAIN TAB 3: Top Gas Finder Legends Leaderboard */
          <div className="flex flex-col gap-4">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-[#004D40] via-primary to-emerald-950 rounded-3xl p-5 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-emerald-500/20">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00FFC2]/20 text-[#00FFC2] border border-[#00FFC2]/30 text-xs font-extrabold mb-2">
                  <span>🏆 Nationwide Driver Leaderboard</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Gas Finder Legends of Nigeria
                </h2>
                <p className="text-xs text-emerald-100/90 mt-1 max-w-xl leading-relaxed">
                  Top drivers earning reputation points & badges by reporting real-time pump pressures, queue wait times, and station stock status.
                </p>
              </div>
            </div>

            {/* Leaderboard — flat divider rows */}
            <div className="flex flex-col divide-y divide-outline-variant/50">
              {leaderboard.length === 0 && (
                <EmptyState
                  icon="leaderboard"
                  title="No ranked drivers yet"
                  message="Be the first — submit verified station reports to earn reputation points and claim the top spot."
                />
              )}
              {leaderboard.map((driver) => (
                <div key={driver.id} className="flex items-center gap-3 py-4">
                  <span
                    className={`w-6 text-body font-bold shrink-0 text-center ${
                      driver.rank <= 3 ? 'text-primary' : 'text-outline'
                    }`}
                  >
                    {driver.rank}
                  </span>

                  <img
                    src={driver.avatar}
                    alt={driver.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-body font-semibold text-on-surface truncate">
                      {driver.name}
                    </h3>
                    <p className="text-caption text-outline font-medium truncate mt-0.5">
                      {[driver.state, driver.tier.title, driver.vehicle].filter(Boolean).join('  ·  ')}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-body font-bold text-primary">{driver.points}</span>
                    <span className="text-caption text-outline font-medium"> pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Floating Action Button (+) */}
      <button
        onClick={onOpenCreatePost}
        aria-label="Create Post"
        className="fixed bottom-24 right-6 w-14 h-14 bg-primary hover:bg-deep-teal text-white rounded-full shadow-[0_8px_24px_rgba(0,108,80,0.35)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40 border-2 border-white"
      >
        <span className="material-symbols-outlined text-[30px]">add</span>
      </button>

      <StationGroupInfoSheet
        isOpen={showInfoSheet}
        onClose={() => setShowInfoSheet(false)}
      />
    </div>
  );
};
