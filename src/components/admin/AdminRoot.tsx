import React from 'react';
import { cn } from '../../lib/utils';
import './admin-theme.css';

/**
 * The root of the admin dashboard. It carries the scoped "Security Print"
 * theme (.admin-ui), forces the light scheme, and sets the ground and ink colours, so nothing in
 * the driver app can pick them up.
 */
export const AdminRoot: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div data-theme="light" className={cn('admin-ui min-h-screen bg-adm-paper text-adm-ink', className)}>
    {children}
  </div>
);
