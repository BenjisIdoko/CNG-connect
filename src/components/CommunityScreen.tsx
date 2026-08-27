import React, { useEffect, useRef, useState } from 'react';
import { CommunityPost, GasStation } from '../types';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';
import { EmptyState } from './common/EmptyState';

interface CommunityScreenProps {
  posts: CommunityPost[];
  stations?: GasStation[];
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
  onOpenDiscussion,
  onOpenChat,
  onOpenCreatePost,
  onOpenStationGroup,
  onOpenNotifications,
  onToggleLikePost,
  onOpenConversions,
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'station_groups' | 'general'>('station_groups');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Local like-state overlay keyed by post id; the post list itself stays in
  // sync with the parent's `posts` prop so newly created posts appear live.
  const [likeOverrides, setLikeOverrides] = useState<Record<string, { isLiked: boolean; likes: number }>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
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

  const filteredStations = stations.filter((st) => {
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
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <h2 className="text-title font-bold text-on-surface tracking-tight">
                  All Station Groups ({filteredStations.length})
                </h2>
                <button
                  onClick={() => setShowInfoSheet(true)}
                  aria-label="Station Group Policy Info"
                  className="w-6 h-6 rounded-full bg-emerald-100 hover:bg-emerald-200 text-primary flex items-center justify-center transition-all active:scale-95"
                  title="Policy Info"
                >
                  <span className="material-symbols-outlined text-[15px]">info</span>
                </button>
              </div>
              <span className="text-micro font-semibold text-primary bg-emerald-100 px-2.5 py-0.5 rounded-xl shrink-0 whitespace-nowrap">
                Active Discussions
              </span>
            </div>

            {/* Status Quick Filter Pills */}
            <div className="flex overflow-x-auto gap-1.5 pb-1 hide-scrollbar">
              {[
                { id: 'all', label: 'All Statuses' },
                { id: 'full', label: 'Full Stock', dotColor: 'bg-live-pulse' },
                { id: 'queue', label: 'Queuing', dotColor: 'bg-amber-500' },
                { id: 'low', label: 'Low Pressure', dotColor: 'bg-secondary-container' },
                { id: 'out', label: 'Out of Gas', dotColor: 'bg-slate-400' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`shrink-0 px-3 py-1 rounded-xl text-micro font-semibold transition-all shadow-2xs active:scale-95 flex items-center gap-1.5 ${
                    statusFilter === st.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st.dotColor && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dotColor}`} />
                  )}
                  <span className="whitespace-nowrap">{st.label}</span>
                </button>
              ))}
            </div>

            {/* Station Groups Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                filteredStations.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => onOpenStationGroup && onOpenStationGroup(st)}
                    className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 hover:border-primary/60 transition-all cursor-pointer flex flex-col gap-2.5 active:scale-[0.99]"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-primary font-bold shrink-0 shadow-xs">
                          <span className="material-symbols-outlined text-[22px]">
                            groups
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-body-lg font-bold text-on-surface leading-tight truncate">
                            {st.name} Group
                          </h3>
                          <p className="text-caption text-outline font-normal flex items-center gap-1 mt-0.5 truncate">
                            <span>{st.city}, {st.state}</span>
                            <span>•</span>
                            <span className="text-primary font-semibold">
                              {st.reports.length} live report{st.reports.length === 1 ? '' : 's'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div
                        className={`px-2.5 py-1 rounded-xl text-micro font-semibold uppercase tracking-wide flex items-center gap-1.5 shrink-0 shadow-2xs border ${
                          st.status === 'full'
                            ? 'bg-emerald-50 text-primary border-emerald-200'
                            : st.status === 'queue'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : st.status === 'low'
                            ? 'bg-orange-50 text-orange-900 border-orange-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            st.status === 'full'
                              ? 'bg-live-pulse'
                              : st.status === 'queue'
                              ? 'bg-amber-500'
                              : st.status === 'low'
                              ? 'bg-secondary-container'
                              : 'bg-slate-400'
                          }`}
                        />
                        <span className="whitespace-nowrap">{st.statusLabel}</span>
                      </div>
                    </div>

                    {/* Latest Notice or Report snippet */}
                    <div className="bg-surface rounded-xl p-2.5 border border-surface-container-highest text-caption text-on-surface-variant">
                      <span className="font-semibold text-primary mr-1">Latest Update:</span>
                      {st.reports?.[0]?.comment || st.stationNotice || `Active discussion feed on pressure (${st.pumpPressure} bar) & queues.`}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-caption font-medium text-outline">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">schedule</span>
                        Updated {st.lastUpdated}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenStationGroup) onOpenStationGroup(st);
                        }}
                        aria-label="Open Station Group"
                        className="w-8 h-8 rounded-full bg-primary hover:bg-deep-teal text-white flex items-center justify-center shadow-2xs transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
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
                    className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/70 flex flex-col gap-3 relative overflow-hidden group hover:border-primary/50 transition-all cursor-pointer"
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
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-body-lg ${
                            post.authorInitialBg || 'bg-secondary-container text-white'
                          }`}
                        >
                          {post.authorInitial || post.author.charAt(0)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-body-lg font-black text-slate-900 truncate">
                            {post.author}
                          </h3>
                          <span className="text-micro font-medium text-slate-400">
                            {post.timeAgo}
                          </span>
                        </div>

                        <div className="inline-flex items-center gap-1 bg-primary-container/20 text-on-primary-container px-2.5 py-0.5 rounded-xl mt-0.5">
                          <span className="text-micro font-black tracking-wider uppercase">
                            {post.categoryLabel || post.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-body-lg font-extrabold text-slate-900 mb-1 group-hover:text-primary transition-colors leading-snug">
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
        )}
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
