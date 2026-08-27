import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';

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
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs animate-fade-in",
            overlayClassName
          )}
        />
        <DialogPrimitive.Content
          aria-label={title || ariaLabel || 'Modal Dialog'}
          className={cn(
            "fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-[101] bg-white w-[92%] max-w-lg rounded-3xl shadow-2xl overflow-y-auto max-h-[88vh] focus:outline-none p-4 sm:p-6",
            className
          )}
        >
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
            {title ? (
              <DialogPrimitive.Title className="font-extrabold text-[16px] sm:text-[17px] text-slate-900 pr-6 truncate">
                {title}
              </DialogPrimitive.Title>
            ) : (
              <div />
            )}
            <DialogPrimitive.Close
              aria-label="Close modal"
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
