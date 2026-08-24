import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, CommunityPost } from '../types';
import { ASSETS, INITIAL_CHAT_MESSAGES } from '../data/mockData';

interface ChatScreenProps {
  post?: CommunityPost;
  onBack: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ post, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'delivered',
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // Simulate seller response
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const sellerReplies = [
          "Sure thing! Here's the 65-liter Type 2 CNG cylinder mounted with steel brackets. Certified by standard inspectors.",
          "I can arrange an inspection for you tomorrow by 2 PM around Allen Avenue. Does that work?",
          "Yes, full tank CNG costs only ₦3,500 and gives you 180km range in Lagos traffic!",
        ];
        const randomReply =
          sellerReplies[Math.floor(Math.random() * sellerReplies.length)];

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-seller-${Date.now()}`,
            sender: 'seller',
            text: randomReply,
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            status: 'read',
          },
        ]);
      }, 1800);
    }, 800);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const photoUrl = event.target?.result as string;
        const newMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          sender: 'user',
          image: photoUrl,
          time: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: 'sent',
        };
        setMessages((prev) => [...prev, newMsg]);
      };
      reader.readAsDataURL(file);
    }
  };

  const listingTitle = post?.title || '2018 Toyota Camry CNG';
  const listingPrice = post?.price || '₦8,500,000';
  const listingImage = post?.image || ASSETS.toyotaCamryListing;
  const sellerName = post?.author || 'Emeka O.';
  const sellerAvatar = post?.authorAvatar || ASSETS.userAvatar;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-between pb-24">
      {/* Sticky Chat Header */}
      <div className="sticky top-16 z-30 bg-surface/95 backdrop-blur-md border-b border-surface-container-highest/70 max-w-xl w-full mx-auto px-4 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container active:scale-95"
          >
            <span className="material-symbols-outlined text-[24px]">
              arrow_back
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={sellerAvatar}
                alt={sellerName}
                className="w-10 h-10 rounded-full object-cover border border-primary/20"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-status-green border-2 border-white rounded-full shadow-xs" />
            </div>
            <div className="min-w-0">
              <h2 className="text-body-lg font-bold text-on-surface leading-tight truncate max-w-[180px] sm:max-w-[240px]">
                {sellerName}
              </h2>
              <span className="text-caption text-primary font-semibold block truncate">
                Active now
              </span>
            </div>
          </div>
        </div>

        <button className="w-10 h-10 flex items-center justify-center rounded-full text-outline hover:bg-surface-container">
          <span className="material-symbols-outlined text-[24px]">
            more_vert
          </span>
        </button>
      </div>

      {/* Pinned Listing Context Card */}
      <div className="max-w-xl w-full mx-auto px-4 pt-3">
        <div className="bg-white rounded-2xl shadow-xs p-3 flex items-center gap-3 border border-surface-container-highest/70 hover:border-primary/40 transition-colors">
          <div
            className="w-12 h-12 rounded-xl bg-cover bg-center shrink-0 border border-surface-container-highest"
            style={{ backgroundImage: `url('${listingImage}')` }}
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-body font-bold text-on-surface truncate">
              {listingTitle}
            </h3>
            <p className="text-body-lg font-bold text-primary mt-0.5">
              {listingPrice}
            </p>
          </div>
          <button className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container">
            <span className="material-symbols-outlined text-[20px]">
              chevron_right
            </span>
          </button>
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 max-w-xl w-full mx-auto px-4 py-4 flex flex-col gap-3">
        {/* Date Divider */}
        <div className="flex items-center justify-center my-1">
          <span className="text-micro font-semibold bg-surface-container text-outline px-3 py-1 rounded-full uppercase tracking-wider">
            Today
          </span>
        </div>

        {messages.map((msg) => {
          const isMe = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 max-w-[85%] ${
                isMe ? 'self-end flex-row-reverse' : 'self-start'
              }`}
            >
              <div className="flex flex-col gap-1">
                {/* Bubble */}
                <div
                  className={`rounded-2xl p-3 shadow-xs text-body-lg font-normal leading-relaxed relative ${
                    isMe
                      ? 'bg-primary text-white rounded-br-xs'
                      : 'bg-white text-on-surface border border-surface-container-highest rounded-bl-xs'
                  }`}
                >
                  {msg.image && (
                    <div className="rounded-xl overflow-hidden mb-2 max-h-56">
                      <img
                        src={msg.image}
                        alt="Shared attachment"
                        className="w-full h-auto object-cover rounded-xl"
                      />
                    </div>
                  )}
                  {msg.text && <p>{msg.text}</p>}
                </div>

                {/* Timestamp & Status */}
                <div
                  className={`flex items-center gap-1 text-micro text-outline px-1 ${
                    isMe ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span>{msg.time}</span>
                  {isMe && (
                    <span
                      className="material-symbols-outlined text-[14px] text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      done_all
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="self-start flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl rounded-bl-xs border border-surface-container-highest shadow-xs">
            <div className="flex gap-1.5 items-center">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: '0.2s' }}
              />
              <div
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: '0.4s' }}
              />
            </div>
            <span className="text-caption font-medium text-outline ml-1">
              {sellerName} is typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Chat Input Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-surface-container-highest p-3 px-4 shadow-lg z-40 pb-safe">
        <div className="max-w-xl mx-auto flex items-end gap-2 bg-surface-container rounded-2xl p-1.5 px-2 border border-surface-container-highest focus-within:ring-2 focus-within:ring-primary/30 transition-all">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add photo"
            className="w-10 h-10 flex shrink-0 items-center justify-center rounded-full text-outline hover:bg-white hover:text-primary transition-colors mb-0.5"
          >
            <span className="material-symbols-outlined text-[22px]">
              add_a_photo
            </span>
          </button>

          <div className="flex-1 py-2 px-1">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="w-full bg-transparent border-none outline-none resize-none max-h-28 text-body-lg text-on-surface placeholder:text-outline m-0 p-0 block"
            />
          </div>

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim()}
            aria-label="Send message"
            className={`w-10 h-10 flex shrink-0 items-center justify-center rounded-full bg-primary text-white transition-all active:scale-95 shadow-xs mb-0.5 ${
              inputText.trim()
                ? 'opacity-100 scale-105'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              send
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
