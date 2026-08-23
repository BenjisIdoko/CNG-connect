import React, { useEffect, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  className = '',
  overlayClassName = '',
  showCloseButton = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap / initial focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in ${overlayClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || ariaLabel || 'Modal Dialog'}
        tabIndex={-1}
        className={`bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden focus:outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <div className="relative">
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-surface-container text-on-surface hover:bg-outline-variant/30 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
