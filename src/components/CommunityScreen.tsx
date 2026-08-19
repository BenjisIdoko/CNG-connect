import React, { useState } from 'react';
import { CommunityPost } from '../types';

interface CommunityScreenProps {
  posts: CommunityPost[];
  onOpenDiscussion: (post: CommunityPost) => void;
  onOpenChat: (post: CommunityPost) => void;
  onOpenCreatePost: () => void;
  onOpenNotifications?: () => void;
}

export const CommunityScreen: React.FC<CommunityScreenProps> = ({
  posts,
  onOpenDiscussion,
  onOpenChat,
  onOpenCreatePost,
  onOpenNotifications,
}) => {
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

  return (
    <div className="min-h-screen bg-[#f2fcf5] text-[#141d19] pb-28 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#141d19]/90 text-white text-[13px] font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      {/* Sticky Search & Notification Bar */}
      <div className="sticky top-16 z-30 bg-[#f2fcf5]/90 backdrop-blur-md py-2.5 px-4 md:px-6 border-b border-[#dbe5de]/70 max-w-xl mx-auto flex items-center gap-3">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6a7b72] text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search community..."
            className="w-full bg-[#e6f0e9] border border-[#dbe5de]/70 rounded-full py-2.5 pl-10 pr-4 text-[14px] font-medium text-[#141d19] placeholder:text-[#6a7b72] focus:outline-none focus:ring-2 focus:ring-[#006c50]/30 focus:bg-white transition-all"
          />
        </div>

        <button
          onClick={onOpenNotifications}
          aria-label="Notifications"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-[#e0ebe4] text-[#141d19] hover:bg-[#dbe5de] transition-colors relative active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[22px]">
            notifications
          </span>
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full border-2 border-white" />
        </button>
      </div>

      <div className="max-w-xl mx-auto px-4 md:px-6">
        {/* Hub Categories Grid */}
        <div className="pt-4 pb-2">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[20px] font-extrabold text-[#141d19] tracking-tight">
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

          <div className="grid grid-cols-2 gap-3">
            {/* Maintenance */}
            <div
              onClick={() =>
                setActiveCategory(
                  activeCategory === 'maintenance' ? 'all' : 'maintenance'
                )
              }
              className={`rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-xs border ${
                activeCategory === 'maintenance'
                  ? 'bg-[#00ffc2]/30 border-[#006c50] ring-2 ring-[#006c50]/20'
                  : 'bg-[#00ffc2]/15 border-transparent hover:bg-[#00ffc2]/25'
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-[#00ffc2] flex items-center justify-center text-[#007255] shadow-xs">
                <span className="material-symbols-outlined text-[22px]">
                  build
                </span>
              </div>
              <span className="text-[14px] font-extrabold text-[#141d19] text-center">
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
              className={`rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-xs border ${
                activeCategory === 'parts'
                  ? 'bg-[#fe9400]/30 border-[#fe9400] ring-2 ring-[#fe9400]/20'
                  : 'bg-[#fe9400]/15 border-transparent hover:bg-[#fe9400]/25'
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-[#fe9400] flex items-center justify-center text-[#633700] shadow-xs">
                <span className="material-symbols-outlined text-[22px]">
                  settings
                </span>
              </div>
              <span className="text-[14px] font-extrabold text-[#141d19] text-center leading-tight">
                Parts &amp;
                <br />
                Accessories
              </span>
            </div>

            {/* Reviews */}
            <div
              onClick={() =>
                setActiveCategory(
                  activeCategory === 'reviews' ? 'all' : 'reviews'
                )
              }
              className={`rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-xs border ${
                activeCategory === 'reviews'
                  ? 'bg-[#ffe149]/40 border-[#FFB800] ring-2 ring-[#FFB800]/20'
                  : 'bg-[#ffe149]/20 border-transparent hover:bg-[#ffe149]/30'
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-[#ffe149] flex items-center justify-center text-[#746300] shadow-xs">
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  star
                </span>
              </div>
              <span className="text-[14px] font-extrabold text-[#141d19] text-center">
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
              className={`rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-xs border ${
                activeCategory === 'deals'
                  ? 'bg-[#FFB800]/30 border-[#8c5000] ring-2 ring-[#8c5000]/20'
                  : 'bg-[#FFB800]/15 border-transparent hover:bg-[#FFB800]/25'
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-[#FFB800] flex items-center justify-center text-[#2d1600] shadow-xs">
                <span className="material-symbols-outlined text-[22px]">
                  local_offer
                </span>
              </div>
              <span className="text-[14px] font-extrabold text-[#141d19] text-center">
                Car Deals
              </span>
            </div>
          </div>
        </div>

        {/* Feed Header */}
        <div className="pt-4 pb-3 flex items-center justify-between">
          <h2 className="text-[20px] font-extrabold text-[#141d19] tracking-tight">
            Recent in your area
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-[#006c50] bg-[#e6f0e9] px-2.5 py-1 rounded-full">
              Lagos &amp; Abuja
            </span>
          </div>
        </div>

        {/* Post Cards List */}
        <div className="flex flex-col gap-4">
          {filteredPosts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-[#dbe5de]">
              <span className="material-symbols-outlined text-[40px] text-[#6a7b72] mb-2">
                forum
              </span>
              <p className="font-bold text-[#141d19] text-[16px]">
                No posts found
              </p>
              <p className="text-[13px] text-[#6a7b72] mt-1">
                Try searching for another topic or clear category filter.
              </p>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => onOpenDiscussion(post)}
                className="bg-white rounded-2xl p-4 shadow-xs border border-[#dbe5de] flex flex-col gap-3 relative overflow-hidden group hover:border-[#006c50]/40 transition-all cursor-pointer"
              >
                {/* Author row */}
                <div className="flex items-start gap-3">
                  {post.authorAvatar ? (
                    <img
                      src={post.authorAvatar}
                      alt={post.author}
                      className="w-10 h-10 rounded-full object-cover border-2 border-[#e6f0e9]"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-[16px] ${
                        post.authorInitialBg || 'bg-[#fe9400] text-white'
                      }`}
                    >
                      {post.authorInitial || post.author.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[14px] font-extrabold text-[#141d19] truncate">
                        {post.author}
                      </h3>
                      <span className="text-[12px] text-[#6a7b72]">
                        {post.timeAgo}
                      </span>
                    </div>

                    {/* Category Tag */}
                    <div className="inline-flex items-center gap-1 bg-[#00ffc2]/20 text-[#007255] px-2.5 py-0.5 rounded-full mt-1">
                      <span className="material-symbols-outlined text-[13px]">
                        {post.category === 'maintenance'
                          ? 'build'
                          : post.category === 'deals'
                          ? 'local_offer'
                          : post.category === 'reviews'
                          ? 'star'
                          : 'settings'}
                      </span>
                      <span className="text-[11px] font-extrabold tracking-wide uppercase">
                        {post.categoryLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h4 className="text-[17px] font-bold text-[#141d19] mb-1 group-hover:text-[#006c50] transition-colors leading-snug">
                    {post.title}
                  </h4>
                  <p className="text-[14px] text-[#3a4a43] line-clamp-3 leading-relaxed">
                    {post.content}
                  </p>
                </div>

                {/* Attached Image */}
                {post.image && (
                  <div className="w-full h-36 rounded-xl bg-[#e6f0e9] overflow-hidden relative">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                    {post.isListing && post.price && (
                      <div className="absolute bottom-2 right-2 bg-[#006c50] text-white text-[13px] font-extrabold px-3 py-1 rounded-lg shadow-md">
                        {post.price}
                      </div>
                    )}
                  </div>
                )}

                {/* Listing Action / Direct Chat Button */}
                {post.isListing && (
                  <div className="flex items-center justify-between bg-[#ecf6ef] p-2.5 rounded-xl border border-[#dbe5de]/60">
                    <span className="text-[13px] font-bold text-[#004D40]">
                      Verified Seller Listing
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenChat(post);
                      }}
                      className="px-3.5 py-1.5 bg-[#006c50] hover:bg-[#004D40] text-white text-[12px] font-bold rounded-full flex items-center gap-1 shadow-xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        chat
                      </span>
                      <span>Message Seller</span>
                    </button>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center gap-4 pt-2 border-t border-[#dbe5de]/60">
                  {/* Like Button */}
                  <button
                    onClick={(e) => handleToggleLike(post.id, e)}
                    className={`flex items-center gap-1.5 text-[13px] font-bold transition-all active:scale-95 ${
                      post.isLiked
                        ? 'text-[#006c50]'
                        : 'text-[#3a4a43] hover:text-[#006c50]'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
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

                  {/* Replies Button */}
                  <button
                    onClick={() => onOpenDiscussion(post)}
                    className="flex items-center gap-1.5 text-[13px] font-bold text-[#3a4a43] hover:text-[#006c50] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      chat_bubble
                    </span>
                    <span>
                      {post.repliesCount}{' '}
                      {post.repliesCount === 1 ? 'Reply' : 'Replies'}
                    </span>
                  </button>

                  {/* Share */}
                  <button
                    onClick={(e) => handleSharePost(post, e)}
                    className="flex items-center gap-1 text-[#3a4a43] hover:text-[#006c50] transition-colors ml-auto p-1"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      share
                    </span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating Action Button (+) */}
      <button
        onClick={onOpenCreatePost}
        aria-label="Create Post"
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#006c50] hover:bg-[#004D40] text-white rounded-full shadow-[0_6px_20px_rgba(0,108,80,0.35)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40 border-2 border-white"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>
    </div>
  );
};
