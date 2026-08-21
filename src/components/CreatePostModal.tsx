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
      <div className="w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-outline-variant max-h-[90vh] overflow-y-auto pb-safe animate-slide-up">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-[20px] font-bold text-on-surface">
            Create Community Post
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Station Group Policy Notice */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-2.5 mb-4 flex items-center justify-between">
          <span className="text-[12px] font-medium text-primary">
            Gas availability posts belong in Station Groups
          </span>
          <button
            type="button"
            onClick={() => setShowInfoSheet(true)}
            aria-label="Station Group Policy Info"
            className="w-6 h-6 rounded-full bg-surface-container-high text-primary flex items-center justify-center transition-all shrink-0 ml-2"
            title="Policy Info"
          >
            <span className="material-symbols-outlined text-[15px]">info</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Category Selector */}
          <div>
            <label className="block text-[13px] font-semibold text-on-surface-variant mb-1.5">
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
                  className={`p-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    category === c.id
                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                      : 'bg-surface-container text-on-surface border-outline-variant hover:bg-surface-container-high'
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
            <label className="block text-[13px] font-semibold text-on-surface-variant mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Best place for sequential CNG kit calibration?"
              className="w-full bg-surface-container border border-outline-variant rounded-2xl p-3 text-[14px] font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* If Deals, Price field */}
          {category === 'deals' && (
            <div>
              <label className="block text-[13px] font-semibold text-on-surface-variant mb-1">
                Asking Price (Naira)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-outline">
                  ₦
                </span>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="8,500,000"
                  className="w-full bg-surface-container border border-outline-variant rounded-2xl p-3 pl-8 text-[14px] font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {/* Content Body */}
          <div>
            <label className="block text-[13px] font-semibold text-on-surface-variant mb-1">
              Details &amp; Description
            </label>
            <textarea
              required
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Provide more context, location, vehicle specs or symptoms..."
              className="w-full bg-surface-container border border-outline-variant rounded-2xl p-3 text-[14px] font-normal text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Image Upload (Live Camera Enforcement & Freshness Verified) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[13px] font-semibold text-on-surface-variant">
                Attach Photo (Live Camera Only)
              </label>
              <span className="text-[10px] font-semibold text-primary bg-surface-container px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-status-green animate-pulse" />
                Anti-Misinformation Verified
              </span>
            </div>

            {imageError && (
              <div className="mb-2 p-2.5 bg-status-red-container border border-status-red/30 rounded-xl text-status-red text-[11.5px] font-medium flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0 text-status-red">
                  gpp_bad
                </span>
                <span>{imageError}</span>
              </div>
            )}

            {attachedImage ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-primary max-h-36">
                <img
                  src={attachedImage}
                  alt="Verified live snapshot"
                  className="w-full h-32 object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-primary/90 text-status-green text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1 border border-status-green/40">
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
                  className="w-full py-3 px-3 bg-primary hover:opacity-95 text-on-primary rounded-xl font-bold text-[13px] shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px] text-status-green shrink-0">photo_camera</span>
                  <span className="whitespace-nowrap">Take Live Photo</span>
                </button>
                <p className="text-[10.5px] font-normal text-outline text-center">
                  🔒 Photo gallery access is disabled to prevent old/fake queue posts.
                </p>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full h-13 mt-2 bg-primary hover:opacity-95 text-on-primary font-bold text-[15px] rounded-full shadow-md active:scale-[0.98] transition-all"
          >
            <span className="whitespace-nowrap">Publish Post</span>
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
