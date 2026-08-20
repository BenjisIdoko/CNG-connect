import React, { useState } from 'react';
import { CommunityPost, GasStation } from '../types';

interface CommunityScreenProps {
  posts: CommunityPost[];
  stations?: GasStation[];
  onOpenDiscussion: (post: CommunityPost) => void;
  onOpenChat: (post: CommunityPost) => void;
  onOpenCreatePost: () => void;
  onOpenStationGroup?: (station: GasStation) => void;
  onOpenNotifications?: () => void;
}

export const CommunityScreen: React.FC<CommunityScreenProps> = ({
  posts,
  stations = [],
  onOpenDiscussion,
  onOpenChat,
  onOpenCreatePost,
  onOpenStationGroup,
  onOpenNotifications,
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'station_groups' | 'general'>('station_groups');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [postList, setPostList] = useState<CommunityPost[]>(posts);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleToggleLike = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPostList((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const wasLiked = p.isLiked;
          return {
            ...p,
            isLiked: !wasLiked,
            likes: wasLiked ? p.likes - 1 : p.likes + 1,
          };
        }
        return p;
      })
    );
  };

  const handleSharePost = (post: CommunityPost, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator
        .share({
          title: post.title,
          text: `${post.title} by ${post.author} on GasFinder Community`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(
        `"${post.title}" - ${post.content.slice(0, 100)}... on GasFinder`
      );
      showToast('Discussion link copied!');
    }
  };

  const filteredPosts = postList.filter((p) => {
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
    return (
      st.name.toLowerCase().includes(q) ||
      st.city.toLowerCase().includes(q) ||
      st.address.toLowerCase().includes(q) ||
      (st.operator && st.operator.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#f2fcf5] text-[#141d19] pb-28 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#141d19]/90 text-white text-[13px] font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      {/* Sticky Top Bar: Main Segment Control + Search */}
      <div className="sticky top-16 z-30 bg-[#f2fcf5]/90 backdrop-blur-md py-2.5 px-4 md:px-6 border-b border-[#dbe5de]/70 max-w-xl mx-auto flex flex-col gap-2">
        {/* Segmented Switcher: Station Groups vs General Discussions */}
        <div className="flex bg-[#e0ebe4] p-1 rounded-2xl border border-[#dbe5de]">
          <button
            onClick={() => setActiveMainTab('station_groups')}
            className={`flex-1 py-2 rounded-xl text-[13px] font-black transition-all flex items-center justify-center gap-1.5 ${
              activeMainTab === 'station_groups'
                ? 'bg-[#006c50] text-white shadow-xs'
                : 'text-[#3a4a43] hover:text-[#141d19]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">groups</span>
            <span>Station Groups ({stations.length})</span>
          </button>

          <button
            onClick={() => setActiveMainTab('general')}
            className={`flex-1 py-2 rounded-xl text-[13px] font-black transition-all flex items-center justify-center gap-1.5 ${
              activeMainTab === 'general'
                ? 'bg-[#006c50] text-white shadow-xs'
                : 'text-[#3a4a43] hover:text-[#141d19]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">forum</span>
            <span>General Hub</span>
          </button>
        </div>

        {/* Search Bar & Notification Button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6a7b72] text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeMainTab === 'station_groups'
                  ? 'Search station groups by name, city or operator...'
                  : 'Search community topics...'
              }
              className="w-full bg-[#e6f0e9] border border-[#dbe5de]/70 rounded-full py-2 pl-10 pr-4 text-[13.5px] font-medium text-[#141d19] placeholder:text-[#6a7b72] focus:outline-none focus:ring-2 focus:ring-[#006c50]/30 focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#e0ebe4] text-[#141d19] hover:bg-[#dbe5de] transition-colors relative active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">
              notifications
            </span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#ba1a1a] rounded-full border-2 border-white" />
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 md:px-6 pt-3">
        {/* MAIN TAB 1: Station Groups List & Scoping Notice */}
        {activeMainTab === 'station_groups' ? (
          <div className="flex flex-col gap-3">
            {/* Scoping Policy Banner */}
            <div className="bg-emerald-500/10 border border-[#006c50]/30 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-[#006c50] text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">local_gas_station</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13.5px] font-black text-[#004D40] leading-tight">
                  Gas Availability Scoping Policy
                </h3>
                <p className="text-[12px] text-[#3a4a43] leading-relaxed mt-0.5">
                  Every CNG station has its own group. <strong>Updates on Gas availability, queues, and pump pressures can only be discussed inside their respective Station Groups.</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <h2 className="text-[18px] font-black text-[#141d19] tracking-tight">
                All Station Groups ({filteredStations.length})
              </h2>
              <span className="text-[11.5px] font-extrabold text-[#006c50] bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Active Discussions
              </span>
            </div>

            {/* Station Groups Cards Grid */}
            <div className="flex flex-col gap-3">
              {filteredStations.map((st) => (
                <div
                  key={st.id}
                  onClick={() => onOpenStationGroup && onOpenStationGroup(st)}
                  className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 hover:border-[#006c50]/60 transition-all cursor-pointer flex flex-col gap-2.5 active:scale-[0.99]"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#006c50] font-black shrink-0 shadow-xs">
                        <span className="material-symbols-outlined text-[22px]">
                          groups
                        </span>
                      </div>
                      <div>
                        <h3 className="text-[15.5px] font-extrabold text-[#141d19] leading-tight">
                          {st.name} Group
                        </h3>
                        <p className="text-[12px] text-[#6a7b72] font-medium flex items-center gap-1 mt-0.5">
                          <span>{st.city}, {st.state}</span>
                          <span>•</span>
                          <span className="text-[#006c50] font-bold">
                            {st.memberCount || 135} members
                          </span>
                        </p>
                      </div>
                    </div>

                    <div
                      className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1 shrink-0 ${
                        st.status === 'full'
                          ? 'bg-[#00E676] text-white'
                          : st.status === 'low'
                          ? 'bg-[#fe9400] text-white'
                          : st.status === 'queue'
                          ? 'bg-[#FFB800] text-slate-900'
                          : 'bg-[#6a7b72] text-white'
                      }`}
                    >
                      <span>{st.statusLabel}</span>
                    </div>
                  </div>

                  {/* Latest Notice or Report snippet */}
                  <div className="bg-[#f2fcf5] rounded-xl p-2.5 border border-[#dbe5de] text-[12.5px] text-[#3a4a43]">
                    <span className="font-extrabold text-[#006c50] mr-1">Latest Update:</span>
                    {st.reports?.[0]?.comment || st.stationNotice || `Active discussion feed on pressure (${st.pumpPressure} bar) & queues.`}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[12px] font-semibold text-[#6a7b72]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      Updated {st.lastUpdated}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenStationGroup) onOpenStationGroup(st);
                      }}
                      className="px-3.5 py-1.5 bg-[#006c50] hover:bg-[#004D40] text-white rounded-full font-bold text-[12px] flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <span>Enter Group Room</span>
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* MAIN TAB 2: General Community Hub (Maintenance, Parts, Deals, Conversions) */
          <div className="flex flex-col gap-4">
            {/* Hub Categories Grid */}
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <h2 className="text-[18px] font-black text-[#141d19] tracking-tight">
                  Hub Categories
                </h2>
                {activeCategory !== 'all' && (
                  <button
                    onClick={() => setActiveCategory('all')}
                    className="text-[12px] font-bold text-[#006c50] hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Pi-CNG Conversion Kit Centers */}
                <div
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === 'conversions' ? 'all' : 'conversions'
                    )
                  }
                  className={`col-span-2 rounded-2xl p-3.5 flex items-center gap-3 transition-all cursor-pointer shadow-xs border active:scale-[0.98] ${
                    activeCategory === 'conversions'
                      ? 'bg-emerald-500/20 border-[#006c50] ring-2 ring-[#006c50]/20'
                      : 'bg-gradient-to-r from-emerald-50 to-teal-50/60 border-emerald-200/80 hover:border-[#006c50]/50'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-[#004D40] flex items-center justify-center text-[#00E676] shadow-sm shrink-0">
                    <span className="material-symbols-outlined text-[22px]">
                      build_circle
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-black text-slate-900 truncate">
                        CNG Kit Conversion Centers
                      </span>
                      <span className="text-[10px] font-extrabold text-[#006c50] bg-emerald-100 px-2 py-0.5 rounded-full">
                        Pi-CNG
                      </span>
                    </div>
                    <p className="text-[11.5px] font-semibold text-slate-500 truncate">
                      337+ Pi-CNG certified centers nationwide
                    </p>
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
                      ? 'bg-[#00ffc2]/30 border-[#006c50] ring-2 ring-[#006c50]/20'
                      : 'bg-white border-slate-200/80 hover:border-[#006c50]/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#00ffc2]/30 flex items-center justify-center text-[#007255] shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">
                      build
                    </span>
                  </div>
                  <span className="text-[13.5px] font-extrabold text-[#141d19] text-center">
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
                      ? 'bg-[#fe9400]/30 border-[#fe9400] ring-2 ring-[#fe9400]/20'
                      : 'bg-white border-slate-200/80 hover:border-[#fe9400]/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#fe9400]/30 flex items-center justify-center text-[#633700] shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">
                      settings
                    </span>
                  </div>
                  <span className="text-[13.5px] font-extrabold text-[#141d19] text-center leading-tight">
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
                      ? 'bg-[#ffe149]/40 border-[#FFB800] ring-2 ring-[#FFB800]/20'
                      : 'bg-white border-slate-200/80 hover:border-[#FFB800]/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#ffe149]/40 flex items-center justify-center text-[#746300] shadow-xs">
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                  </div>
                  <span className="text-[13.5px] font-extrabold text-[#141d19] text-center">
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
                      ? 'bg-[#FFB800]/30 border-[#8c5000] ring-2 ring-[#8c5000]/20'
                      : 'bg-white border-slate-200/80 hover:border-[#FFB800]/40'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#FFB800]/30 flex items-center justify-center text-[#2d1600] shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">
                      local_offer
                    </span>
                  </div>
                  <span className="text-[13.5px] font-extrabold text-[#141d19] text-center">
                    Car Deals
                  </span>
                </div>
              </div>
            </div>

            {/* General Discussions List */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-black text-slate-900 tracking-tight">
                  General Discussions
                </h2>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80 shadow-xs">
                  <span className="material-symbols-outlined text-[40px] text-slate-400 mb-2">
                    forum
                  </span>
                  <p className="font-extrabold text-slate-900 text-[16px]">
                    No posts found
                  </p>
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => onOpenDiscussion(post)}
                    className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/70 flex flex-col gap-3 relative overflow-hidden group hover:border-[#006c50]/50 transition-all cursor-pointer"
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
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-[15px] ${
                            post.authorInitialBg || 'bg-[#fe9400] text-white'
                          }`}
                        >
                          {post.authorInitial || post.author.charAt(0)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[14.5px] font-black text-slate-900 truncate">
                            {post.author}
                          </h3>
                          <span className="text-[11.5px] font-medium text-slate-400">
                            {post.timeAgo}
                          </span>
                        </div>

                        <div className="inline-flex items-center gap-1 bg-[#00ffc2]/20 text-[#007255] px-2.5 py-0.5 rounded-full mt-0.5">
                          <span className="text-[10.5px] font-black tracking-wider uppercase">
                            {post.categoryLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[16px] font-extrabold text-slate-900 mb-1 group-hover:text-[#006c50] transition-colors leading-snug">
                        {post.title}
                      </h4>
                      <p className="text-[13.5px] font-medium text-slate-600 line-clamp-3 leading-relaxed">
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
                        className={`flex items-center gap-1.5 text-[12.5px] font-extrabold transition-all active:scale-95 ${
                          post.isLiked
                            ? 'text-[#006c50]'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[19px]"
                          style={{
                            fontVariationSettings: post.isLiked
                              ? "'FILL' 1"
                              : "'FILL' 0",
                          }}
                        >
                          thumb_up
                        </span>
                        <span>{post.likes}</span>
                      </button>

                      <button
                        onClick={() => onOpenDiscussion(post)}
                        className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-slate-500 hover:text-slate-800 transition-colors"
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
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#00c853] hover:bg-[#00a843] text-white rounded-full shadow-[0_8px_24px_rgba(0,200,83,0.4)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40 border-2 border-white"
      >
        <span className="material-symbols-outlined text-[30px]">add</span>
      </button>
    </div>
  );
};
