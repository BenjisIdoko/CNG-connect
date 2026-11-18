import * as React from 'react';
import { cn } from '../../lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full rounded-md border border-adm-line bg-adm-card px-3 py-2 text-sm text-adm-ink caret-adm-note placeholder:text-adm-mute-text outline-none transition-colors focus-visible:border-adm-note focus-visible:ring-2 focus-visible:ring-adm-note/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-adm-danger',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
