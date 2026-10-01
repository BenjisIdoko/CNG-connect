import React, { useEffect, useRef, useState } from 'react';
import { CommunityPost, GasStation } from '../types';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';
import { EmptyState } from './common/EmptyState';
import type { LeaderboardDriver } from '../utils/reputationEngine';
import { apiService } from '../services/apiService';
import { isSameState } from '../utils/proximityAlertEngine';
import { Icon } from './common/Icon';

// Legends leaderboard is built but hidden for now; flip to true to bring the tab back.
const SHOW_LEADERBOARD = false;

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
    if (!SHOW_LEADERBOARD) return;
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
  const [sortByNearest, setSortByNearest] = useState(false);

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

  const filteredStations = scopedStationGroups
    .filter((st) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        st.name.toLowerCase().includes(q) ||
        st.city.toLowerCase().includes(q) ||
        st.state.toLowerCase().includes(q) ||
        st.address.toLowerCase().includes(q) ||
        (st.operator && st.operator.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || st.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (!sortByNearest) return 0;
      const da = parseFloat(a.distance?.match(/([\d.]+)/)?.[1] || '') || Infinity;
      const db = parseFloat(b.distance?.match(/([\d.]+)/)?.[1] || '') || Infinity;
      return da - db;
    });

  return (
    // data-theme="light": same reasoning as the other rebuilt screens — the handoff has no
    // dark-mode values yet, and this screen now mixes literal bg-white/rd-ink with tokens
    // that'd otherwise flip dark on their own.
    <div data-theme="light" className="min-h-screen bg-rd-bg text-rd-ink pb-28 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface/90 text-white text-body font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      {/* Sticky Top Bar: Title + Main Segment Control + Search */}
      <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md py-3 px-4 md:px-6 shadow-[0_2px_10px_rgba(31,41,35,0.04)] max-w-4xl mx-auto flex flex-col gap-3">
        {/* Title row: Community + share + bell, per design_handoff_cng_connect_mobile 3d */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-geist text-[1.75rem] font-bold text-rd-ink tracking-tight">Community</h1>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'CNG-Connect Community', url: window.location.href }).catch(() => {});
                } else {
                  navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => showToast('Link copied!'))
                    .catch(() => {});
                }
              }}
              aria-label="Share the community"
              className="w-11 h-11 rounded-full bg-surface-container-high text-rd-ink flex items-center justify-center active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">share</span>
            </button>
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
              className="relative w-11 h-11 rounded-full bg-surface-container-high text-rd-ink flex items-center justify-center active:scale-95 transition-transform"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full border-2 border-white" />
            </button>
          </div>
        </div>

        {/* Main Section Tab Switcher */}
        <div className="relative flex bg-surface-container p-1 rounded-full">
          {/* Sliding pill behind the active tab */}
          <span
            aria-hidden
            className="absolute top-1 bottom-1 left-1 rounded-full bg-rd-ink shadow-xs transition-transform duration-300 ease-[cubic-bezier(0.3,1,0.4,1)]"
            style={{
              width: `calc((100% - 8px) / ${SHOW_LEADERBOARD ? 3 : 2})`,
              transform: `translateX(${['station_groups', 'general', 'leaderboard'].indexOf(activeMainTab) * 100}%)`,
            }}
          />
          <button
            onClick={() => setActiveMainTab('station_groups')}
            className={`relative z-10 flex-1 py-2.5 rounded-full text-caption font-bold transition-colors text-center ${
              activeMainTab === 'station_groups'
                ? 'text-white'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="whitespace-nowrap">Station Groups ({stations.length})</span>
          </button>

          <button
            onClick={() => setActiveMainTab('general')}
            className={`relative z-10 flex-1 py-2.5 rounded-full text-caption font-bold transition-colors text-center ${
              activeMainTab === 'general'
                ? 'text-white'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="whitespace-nowrap">General Hub</span>
          </button>

          {SHOW_LEADERBOARD && (
            <button
              onClick={() => setActiveMainTab('leaderboard')}
              className={`relative z-10 flex-1 py-2.5 rounded-full text-caption font-bold transition-colors text-center flex items-center justify-center gap-1 ${
                activeMainTab === 'leaderboard'
                  ? 'text-white'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="whitespace-nowrap inline-flex items-center gap-1"><Icon name="emoji_events" size={16} fill /> Legends</span>
            </button>
          )}
        </div>

        {/* Search Bar + (Station Groups only) Nearest sort */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center">
            <span aria-hidden="true" className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeMainTab === 'station_groups'
                  ? 'Search groups or city'
                  : 'Search tips and deals'
              }
              className="w-full bg-surface-container rounded-full py-2.5 pl-10 pr-9 text-body font-normal text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface-container-high transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-on-surface rounded-full shrink-0"
                aria-label="Clear search query"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {activeMainTab === 'station_groups' && (
            <button
              onClick={() => setSortByNearest((v) => !v)}
              aria-pressed={sortByNearest}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-caption font-bold transition-colors active:scale-95 ${
                sortByNearest ? 'bg-rd-ink text-white' : 'bg-surface-container text-rd-ink'
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">near_me</span>
              Nearest
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-3">
        {/* MAIN TAB 1: Station Groups List & Scoping Notice */}
        {activeMainTab === 'station_groups' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-title font-bold text-on-surface tracking-tight truncate">
                  Station Groups ({filteredStations.length})
                </h2>
                <button
                  onClick={() => setShowInfoSheet(true)}
                  aria-label="Station Group Policy Info"
                  className="w-6 h-6 rounded-full bg-emerald-100 hover:bg-emerald-200 text-primary flex items-center justify-center transition-all active:scale-95 shrink-0"
                  title="Policy Info"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[15px]">info</span>
                </button>
              </div>
              {/* Status filter — collapsed into a single control */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowStatusMenu((v) => !v)}
                  aria-label="Filter station groups by status"
                  className={`flex items-center gap-1 text-micro font-semibold px-2 py-2 rounded-xl border transition-colors active:scale-95 ${
                    statusFilter === 'all'
                      ? 'bg-surface-container-high text-slate-600 border-slate-200 hover:bg-surface-container'
                      : 'bg-primary text-white border-primary'
                  }`}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">tune</span>
                  {statusFilter !== 'all' && (
                    <span className="whitespace-nowrap">
                      {STATUS_OPTIONS.find((o) => o.id === statusFilter)?.label}
                    </span>
                  )}
                  <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
                    {showStatusMenu ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {showStatusMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowStatusMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 z-40 w-44 bg-surface-container-high rounded-2xl border border-slate-200 shadow-lg py-1 overflow-hidden">
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
                            <span aria-hidden="true" className="material-symbols-outlined text-[16px] ml-auto">check</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <p className="text-[0.8125rem] text-rd-text-tertiary leading-relaxed -mt-1">
              Each station has one group for pump status and queues. Everything else goes in the General hub.
            </p>

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
                  const dotColor =
                    st.status === 'full'
                      ? 'bg-rd-available'
                      : st.status === 'queue'
                      ? 'bg-rd-queuing'
                      : st.status === 'low'
                      ? 'bg-rd-low'
                      : st.status === 'out'
                      ? 'bg-rd-out'
                      : 'bg-slate-400';
                  return (
                    <div
                      key={st.id}
                      onClick={() => onOpenStationGroup && onOpenStationGroup(st)}
                      className="flex items-center gap-3 py-4 cursor-pointer transition-colors active:bg-surface-container/40 md:bg-white md:p-4 md:rounded-2xl md:border md:border-slate-200/80 md:shadow-2xs md:hover:border-primary/60 md:active:bg-transparent"
                    >
                      <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-emerald-50 flex items-center justify-center text-primary">
                        {st.images?.[0] ? (
                          <img src={st.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span aria-hidden="true" className="material-symbols-outlined text-[22px]">local_gas_station</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-body font-semibold text-rd-ink leading-tight truncate">{st.name}</h3>
                          {st.verifiedByCommunity && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-rd-available-container text-rd-on-available-container px-1.5 py-0.5 text-[0.6875rem] font-bold">
                              <span aria-hidden="true" className="material-symbols-outlined text-[11px] material-symbols-fill">verified</span>
                              Official
                            </span>
                          )}
                        </div>
                        <p className="text-caption text-rd-text-tertiary font-medium mt-1 flex items-center gap-1.5 truncate">
                          {st.status !== 'unknown' && (
                            <span className="inline-flex items-center gap-1 shrink-0">
                              <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              <span className="text-rd-ink font-semibold">{st.statusLabel}</span>
                            </span>
                          )}
                          <span className="truncate">{st.city}, {st.state}</span>
                        </p>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {st.distance && <span className="text-caption font-semibold text-rd-text-tertiary">{st.distance}</span>}
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-rd-text-tertiary">chevron_right</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeMainTab === 'general' ? (
          /* MAIN TAB 2: General Community Hub (Maintenance, Parts, Deals, Conversions) */
          <div className="flex flex-col gap-4">
            {/* Topic chips — design_handoff_cng_connect_mobile 3f (height-44 chip row). Kept
                this app's existing category set (conversions/maintenance/parts/reviews/deals)
                rather than swapping to the handoff's (conversion/questions/road trips) — the
                seeded post data is already tagged with the former, and changing the taxonomy
                itself is a data-model change, not a visual one. */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {[
                { id: 'all', label: 'All', icon: null },
                { id: 'conversions', label: 'Conversion', icon: 'build_circle' },
                { id: 'maintenance', label: 'Maintenance', icon: 'build' },
                { id: 'parts', label: 'Parts', icon: 'settings' },
                { id: 'reviews', label: 'Reviews', icon: 'star' },
                { id: 'deals', label: 'Deals', icon: 'local_offer' },
              ].map((chip) => {
                const active = activeCategory === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => {
                      if (chip.id === 'conversions' && onOpenConversions) {
                        onOpenConversions();
                        return;
                      }
                      setActiveCategory(chip.id === activeCategory ? 'all' : chip.id);
                    }}
                    className={`shrink-0 h-11 flex items-center gap-1.5 px-4 rounded-full text-caption font-bold transition-colors active:scale-95 ${
                      active ? 'bg-rd-ink text-white' : 'bg-white text-rd-ink ring-1 ring-[#E3E6E4]'
                    }`}
                  >
                    {chip.icon && <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{chip.icon}</span>}
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Pump-status redirect banner */}
            <div className="rounded-2xl bg-rd-available-container px-4 py-3 flex items-center gap-3">
              <span aria-hidden="true" className="material-symbols-outlined text-rd-on-available-container text-[20px] shrink-0">local_gas_station</span>
              <p className="flex-1 text-caption font-semibold text-rd-on-available-container">
                Pump status goes in station groups, where it reaches the map.
              </p>
              <button
                onClick={() => setActiveMainTab('station_groups')}
                className="shrink-0 rounded-full bg-white text-rd-on-available-container text-[0.75rem] font-bold px-3 py-1.5 active:scale-95 transition-transform"
              >
                Find group
              </button>
            </div>

            {/* General Discussions List */}
            <div className="flex flex-col gap-4">

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
                    className="bg-surface-container-high rounded-2xl p-4 shadow-2xs border border-slate-200/70 flex flex-col gap-3 relative overflow-hidden group hover:border-primary/50 transition-all cursor-pointer"
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h3 className="text-body font-semibold text-slate-900 truncate">
                              {post.author}
                            </h3>
                            {post.verified && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-rd-available-container text-rd-on-available-container px-1.5 py-0.5 text-[0.6875rem] font-bold whitespace-nowrap">
                                <span aria-hidden="true" className="material-symbols-outlined text-[11px] material-symbols-fill">workspace_premium</span>
                                Verified Reporter
                              </span>
                            )}
                          </div>
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

                    <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                      <button
                        onClick={(e) => handleToggleLike(post.id, e)}
                        aria-pressed={likeOverrides[post.id]?.isLiked ?? Boolean(post.isLiked)}
                        className={`flex items-center gap-2 text-caption font-extrabold transition-all active:scale-95 ${
                          (likeOverrides[post.id]?.isLiked ?? Boolean(post.isLiked))
                            ? 'text-primary'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span aria-hidden="true"
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
                        className="flex items-center gap-2 text-caption font-extrabold text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        <span aria-hidden="true" className="material-symbols-outlined text-[19px]">
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
                        <span aria-hidden="true" className="material-symbols-outlined text-[19px]">
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
            <div className="bg-deep-teal rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/30 text-white text-xs font-extrabold mb-2">
                  <span className="inline-flex items-center gap-1.5"><Icon name="emoji_events" size={14} fill /> Nationwide Driver Leaderboard</span>
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
                    <p className="text-caption text-outline font-medium truncate mt-1">
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

      {/* "New post" FAB — design_handoff_cng_connect_mobile 3d (labeled pill, not a bare +) */}
      <button
        onClick={onOpenCreatePost}
        aria-label="New post"
        className="fixed bottom-24 right-5 h-[52px] pl-4 pr-5 bg-primary hover:bg-emerald-700 text-white rounded-full shadow-[0_10px_24px_rgba(40,132,53,0.35)] flex items-center gap-2 font-geist font-bold text-body transition-all active:scale-95 z-40"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">edit</span>
        New post
      </button>

      <StationGroupInfoSheet
        isOpen={showInfoSheet}
        onClose={() => setShowInfoSheet(false)}
      />
    </div>
  );
};
