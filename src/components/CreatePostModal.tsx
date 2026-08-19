import React, { useState } from 'react';
import { CommunityPost } from '../types';
import { ASSETS } from '../data/mockData';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitPost: (newPost: CommunityPost) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onSubmitPost,
}) => {
  const [category, setCategory] = useState<'maintenance' | 'parts' | 'reviews' | 'deals'>('maintenance');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target?.result as string);
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

    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      author: 'Tunde Adebayo',
      authorAvatar: ASSETS.userAvatar,
      verified: true,
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
        <div className="flex justify-between items-center mb-4">
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

          {/* Image Upload */}
          <div>
            <label className="block text-[13px] font-bold text-[#3a4a43] mb-1">
              Attach Image (Optional)
            </label>
            {attachedImage ? (
              <div className="relative rounded-2xl overflow-hidden border border-[#006c50] max-h-36">
                <img
                  src={attachedImage}
                  alt="Uploaded preview"
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full hover:bg-black"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    close
                  </span>
                </button>
              </div>
            ) : (
              <label className="w-full flex items-center justify-center p-3 border-2 border-dashed border-[#b9cbc1] rounded-2xl bg-[#e6f0e9]/50 hover:bg-[#e6f0e9] transition-colors cursor-pointer gap-2 text-[#6a7b72]">
                <span className="material-symbols-outlined text-[22px]">
                  add_photo_alternate
                </span>
                <span className="text-[13px] font-bold">Select vehicle or part photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
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
    </div>
  );
};
