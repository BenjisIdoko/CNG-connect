import React from 'react';
import { Modal } from './common/Modal';
import { InviteCard } from './InviteCard';

/** Bottom sheet opened by the "Share the App" buttons: how the ₦500 promo works, the driver's code, and the share action. */
export const ShareAppSheet: React.FC<{
  onClose: () => void;
  onSignIn: () => void;
  onToast: (m: string) => void;
}> = ({ onClose, onSignIn, onToast }) => (
  <Modal isOpen onClose={onClose} title="Share the app, earn ₦500 airtime">
    <InviteCard variant="sheet" onSignIn={onSignIn} onToast={onToast} />
  </Modal>
);
