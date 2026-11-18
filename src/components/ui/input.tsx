import * as React from 'react';
import { cn } from '../../lib/utils';

function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-adm-line bg-adm-card px-3 text-sm text-adm-ink caret-adm-note placeholder:text-adm-mute-text outline-none transition-colors focus-visible:border-adm-note focus-visible:ring-2 focus-visible:ring-adm-note/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-adm-danger',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
