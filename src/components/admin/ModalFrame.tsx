import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface Props {
  /** Called when the dialog should close (Escape, click outside, or the caller's own Close button). */
  onClose: () => void;
  /** Spoken title for screen readers; the visible heading stays in the caller's own header. */
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps an editor panel in the kit's Radix Dialog so it traps focus, closes on Escape, is announced
 * as a modal dialog and returns focus on close. The caller keeps its own header, body and footer
 * markup as children; this only supplies the frame.
 */
export const ModalFrame: React.FC<Props> = ({ onClose, title, description, className, children }) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent showCloseButton={false} className={cn('max-w-2xl gap-0 overflow-hidden p-0', className)}>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <DialogDescription className="sr-only">{description ?? title}</DialogDescription>
      {children}
    </DialogContent>
  </Dialog>
);
