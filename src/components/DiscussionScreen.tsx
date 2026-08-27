import React, { useState } from 'react';
import { CommunityPost, CommentItem, UserProfile } from '../types';
import { ASSETS } from '../data/mockData';

interface DiscussionScreenProps {
  post: CommunityPost;
  user?: UserProfile;
  onBack: () => void;
}

export const DiscussionScreen: React.FC<DiscussionScreenProps> = ({
  post,
  user,
  onBack,
}) => {
  const [comments, setComments] = useState<CommentItem[]>(post.comments);
  const [newCommentText, setNewCommentText] = useState('');
  const [likesCount, setLikesCount] = useState(post.likes);
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  React.useEffect(() => {
    setComments(post.comments || []);
    setLikesCount(post.likes || 0);
    setIsLiked(Boolean(post.isLiked));
  }, [post]);

  const handleToggleLike = () => {
    if (isLiked) {
      setLikesCount((c) => c - 1);
      setIsLiked(false);
    } else {
      setLikesCount((c) => c + 1);
      setIsLiked(true);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: CommentItem = {
      id: `comment-${Date.now()}`,
      author: 'Tunde Adebayo',
      authorAvatar: ASSETS.userAvatar,
      timeAgo: 'Just now',
      content: replyingTo
        ? `@${replyingTo} ${newCommentText.trim()}`
        : newCommentText.trim(),
    };

    setComments((prev) => [...prev, newComment]);
    setNewCommentText('');
    setReplyingTo(null);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-32">
      {/* Post Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-4">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-surface-container-highest flex flex-col gap-4">
          {/* Author Row */}
          <div className="flex items-center gap-3">
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={post.author}
                className="w-12 h-12 rounded-full object-cover shadow-xs border-2 border-surface-container"
              />
            ) : (
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-title ${
                  post.authorInitialBg || 'bg-secondary-container text-white'
                }`}
              >
                {post.authorInitial || post.author.charAt(0)}
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-body-lg text-on-surface">
                  {post.author}
                </span>
                {post.verified && (
                  <span
                    className="material-symbols-outlined text-primary text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified
                  </span>
                )}
              </div>
              <span className="text-caption text-outline">{post.timeAgo}</span>
            </div>

            {/* Category Tag */}
            <div className="bg-primary-container/20 text-on-primary-container px-3 py-1 rounded-xl text-micro font-semibold uppercase tracking-wide">
              {post.categoryLabel}
            </div>
          </div>

          {/* Post Title and Body */}
          <div>
            <h1 className="text-heading font-bold text-on-surface leading-tight mb-2">
              {post.title}
            </h1>
            <p className="text-body-lg text-on-surface-variant font-normal leading-relaxed">
              {post.content}
            </p>
          </div>

          {/* Attached Photo */}
          {post.image && (
            <div className="w-full rounded-2xl overflow-hidden shadow-xs border border-surface-container-highest aspect-video relative bg-surface-container">
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
              {post.price && (
                <div className="absolute bottom-3 right-3 bg-primary text-white text-body font-bold px-3.5 py-1.5 rounded-xl shadow-md">
                  {post.price}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-surface-container-highest/70 pt-3 mt-1">
            <div className="flex gap-4">
              <button
                onClick={handleToggleLike}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-body font-medium transition-all active:scale-95 ${
                  isLiked
                    ? 'bg-primary text-white'
                    : 'bg-surface text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  thumb_up
                </span>
                <span>{likesCount}</span>
              </button>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-on-surface-variant text-body font-medium">
                <span className="material-symbols-outlined text-[20px]">
                  chat_bubble_outline
                </span>
                <span>{comments.length}</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: post.title,
                    text: post.content,
                    url: window.location.href,
                  });
                }
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">
                share
              </span>
            </button>
          </div>
        </div>

        {/* Comments Feed */}
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-[22px]">
              forum
            </span>
            <h2 className="text-title font-bold text-on-surface">
              {comments.length} Comments
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-white rounded-2xl p-4 shadow-xs border border-surface-container-highest flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {comment.authorAvatar ? (
                      <img
                        src={comment.authorAvatar}
                        alt={comment.author}
                        className="w-9 h-9 rounded-full object-cover border border-surface-container-highest"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-body">
                        {comment.author.charAt(0)}
                      </div>
                    )}
                    <div>
                      <span className="text-body font-bold text-on-surface">
                        {comment.author}
                      </span>
                      <span className="text-micro text-outline ml-2">
                        {comment.timeAgo}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setReplyingTo(comment.author)}
                    className="text-caption font-semibold text-primary hover:underline"
                  >
                    Reply
                  </button>
                </div>

                <p className="text-body text-on-surface-variant font-normal leading-relaxed pl-1">
                  {comment.content}
                </p>

                {/* Nested Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-2 ml-4 pl-3 border-l-2 border-primary/30 flex flex-col gap-2">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="pt-1">
                        <div className="flex items-center gap-2">
                          <img
                            src={reply.authorAvatar}
                            alt={reply.author}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <span className="text-caption font-semibold text-on-surface">
                            {reply.author}
                          </span>
                          <span className="text-micro text-outline">
                            {reply.timeAgo}
                          </span>
                        </div>
                        <p className="text-body font-normal text-on-surface-variant mt-0.5">
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
      </div>

      {/* Fixed Sticky Comment Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-3 px-4 border-t border-surface-container-highest shadow-lg z-40 pb-safe">
        <div className="max-w-xl mx-auto">
          {replyingTo && (
            <div className="flex items-center justify-between text-caption text-primary font-semibold mb-1.5 px-2">
              <span>Replying to @{replyingTo}</span>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-outline hover:text-black"
              >
                Cancel
              </button>
            </div>
          )}
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <div className="flex-1 bg-surface-container rounded-full h-12 flex items-center px-4 border border-surface-container-highest">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={
                  replyingTo ? `Reply to ${replyingTo}...` : 'Add a comment...'
                }
                className="w-full bg-transparent border-none outline-none text-body text-on-surface placeholder:text-outline"
              />
            </div>
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              aria-label="Send comment"
              className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-deep-teal disabled:opacity-40 transition-all active:scale-95 shrink-0"
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                send
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
