import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/** Small status chip. `new` is the pale yellow tint for anything new or changed since the last visit. */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-2 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-adm-note text-white',
        secondary: 'bg-adm-muted text-adm-ink',
        outline: 'border-adm-line text-adm-ink',
        destructive: 'bg-adm-danger-soft text-adm-danger border-adm-danger/30',
        warning: 'bg-adm-warn-soft text-adm-warn border-adm-warn/30',
        new: 'bg-adm-new text-adm-ink border-adm-foil/60',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" data-variant={variant ?? 'default'} className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
