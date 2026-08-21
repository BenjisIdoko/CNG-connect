import React, { useState } from 'react';
import { CommunityPost, UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import { LiveCameraCaptureModal } from './LiveCameraCaptureModal';
import { StationGroupInfoSheet } from './StationGroupInfoSheet';

interface CreatePostModalProps {
  isOpen: boolean;
  user?: UserProfile;
  onClose: () => void;
  onSubmitPost: (newPost: CommunityPost) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  user,
  onClose,
  onSubmitPost,
}) => {
  const [category, setCategory] = useState<'maintenance' | 'parts' | 'reviews' | 'deals'>('maintenance');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImageError(null);
        setAttachedImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const categoryLabels = {
      maintenance: 'Maintenance',
      parts: 'Parts & Accessories',
      reviews: 'Reviews',
      deals: 'Car Deals',
    };

    const hasVerifiedPhoto = Boolean(attachedImage);

    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      author: user?.name || 'Tunde Adebayo',
      authorAvatar: user?.avatar || ASSETS.userAvatar,
      verified: hasVerifiedPhoto,
      timeAgo: 'Just now',
      category,
      categoryLabel: categoryLabels[category],
      title: title.trim(),
      content: content.trim(),
      image: attachedImage || undefined,
      likes: 1,
      isLiked: true,
      repliesCount: 0,
      comments: [],
      isListing: category === 'deals',
      price: category === 'deals' ? (price ? `₦${price}` : undefined) : undefined,
    };

    onSubmitPost(newPost);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-[#f2fcf5] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-[#dbe5de] max-h-[90vh] overflow-y-auto pb-safe animate-slide-up">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[20px] font-extrabold text-[#141d19]">
            Create Community Post
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6a7b72] hover:bg-[#e6f0e9]"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Station Group Policy Notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 mb-4 flex items-center justify-between">
          <span className="text-[12px] font-bold text-[#004D40]">
            Gas availability posts belong in Station Groups
          </span>
          <button
            type="button"
            onClick={() => setShowInfoSheet(true)}
            aria-label="Station Group Policy Info"
            className="w-6 h-6 rounded-full bg-emerald-200 hover:bg-emerald-300 text-[#006c50] flex items-center justify-center transition-all shrink-0 ml-2"
            title="Policy Info"
          >
            <span className="material-symbols-outlined text-[15px]">info</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Category Selector */}
          <div>
            <label className="block text-[13px] font-bold text-[#3a4a43] mb-1.5">
              Select Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'maintenance', label: 'Maintenance', icon: 'build' },
                { id: 'parts', label: 'Parts & Acc.', icon: 'settings' },
                { id: 'reviews', label: 'Reviews', icon: 'star' },
                { id: 'deals', label: 'Car Deals', icon: 'local_offer' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id as any)}
                  className={`p-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    category === c.id
                      ? 'bg-[#006c50] text-white border-[#006c50] shadow-xs'
                      : 'bg-[#e6f0e9] text-[#141d19] border-[#dbe5de] hover:bg-[#dbe5de]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {c.icon}
                  </span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[13px] font-bold text-[#3a4a43] mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Best place for sequential CNG kit calibration?"
              className="w-full bg-[#e6f0e9] border border-[#dbe5de] rounded-2xl p-3 text-[14px] font-bold text-[#141d19] placeholder:text-[#6a7b72] focus:outline-none focus:ring-2 focus:ring-[#006c50]/30"
            />
          </div>

          {/* If Deals, Price field */}
          {category === 'deals' && (
            <div>
              <label className="block text-[13px] font-bold text-[#3a4a43] mb-1">
                Asking Price (Naira)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[#6a7b72]">
                  ₦
                </span>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="8,500,000"
                  className="w-full bg-[#e6f0e9] border border-[#dbe5de] rounded-2xl p-3 pl-8 text-[14px] font-bold text-[#141d19] placeholder:text-[#6a7b72] focus:outline-none focus:ring-2 focus:ring-[#006c50]/30"
                />
              </div>
            </div>
          )}

          {/* Content Body */}
          <div>
            <label className="block text-[13px] font-bold text-[#3a4a43] mb-1">
              Details &amp; Description
            </label>
            <textarea
              required
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Provide more context, location, vehicle specs or symptoms..."
              className="w-full bg-[#e6f0e9] border border-[#dbe5de] rounded-2xl p-3 text-[14px] font-medium text-[#141d19] placeholder:text-[#6a7b72] focus:outline-none focus:ring-2 focus:ring-[#006c50]/30"
            />
          </div>

          {/* Image Upload (Live Camera Enforcement & Freshness Verified) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[13px] font-bold text-[#3a4a43]">
                Attach Photo (Live Camera Only)
              </label>
              <span className="text-[10px] font-extrabold text-[#006c50] bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00c853] animate-pulse" />
                Anti-Misinformation Verified
              </span>
            </div>

            {imageError && (
              <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11.5px] font-bold flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0 text-rose-600">
                  gpp_bad
                </span>
                <span>{imageError}</span>
              </div>
            )}

            {attachedImage ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#006c50] max-h-36">
                <img
                  src={attachedImage}
                  alt="Verified live snapshot"
                  className="w-full h-32 object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-[#004D40]/90 text-[#00E676] text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 border border-emerald-400/40">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                  Fresh Camera Verified
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttachedImage(null);
                    setImageError(null);
                  }}
                  className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full hover:bg-black"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    close
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowLiveCamera(true)}
                  className="w-full py-3 px-3 bg-[#004D40] hover:bg-[#006c50] text-white rounded-xl font-extrabold text-[13px] shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px] text-[#00E676]">photo_camera</span>
                  <span>Take Live Camera Photo (Gallery Blocked)</span>
                </button>
                <p className="text-[10.5px] font-semibold text-[#6a7b72] text-center">
                  🔒 Photo gallery access is disabled to prevent old/fake queue posts.
                </p>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full h-13 mt-2 bg-[#006c50] hover:bg-[#004D40] text-white font-extrabold text-[15px] rounded-full shadow-md active:scale-[0.98] transition-all"
          >
            Publish Post
          </button>
        </form>
      </div>

      {showLiveCamera && (
        <LiveCameraCaptureModal
          title="Live Community Post Snapshot"
          onCapture={(dataUrl) => {
            setAttachedImage(dataUrl);
            setImageError(null);
            setShowLiveCamera(false);
          }}
          onClose={() => setShowLiveCamera(false)}
        />
      )}

      <StationGroupInfoSheet
        isOpen={showInfoSheet}
        onClose={() => setShowInfoSheet(false)}
      />
    </div>
  );
};
