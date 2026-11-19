import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * shadcn Button, themed for the admin dashboard ("Security Print"). The default variant is foil
 * gold with ink text: gold is reserved for things that can be pressed. The other variants stay
 * green, outlined or red so gold keeps meaning "you can act here".
 */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-adm-note focus-visible:ring-offset-2 focus-visible:ring-offset-adm-paper disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-adm-foil text-adm-ink hover:bg-adm-foil-hover',
        destructive: 'bg-adm-danger text-white hover:bg-adm-danger/90',
        outline: 'border border-adm-line bg-adm-card text-adm-ink hover:bg-adm-muted',
        secondary: 'bg-adm-note text-white hover:bg-adm-note-2',
        ghost: 'text-adm-ink hover:bg-adm-muted',
        link: 'text-adm-note underline underline-offset-4 hover:no-underline',
      },
      size: {
        default: 'h-9 px-4 py-2 max-md:h-11',
        sm: 'h-8 gap-1.5 px-3 max-md:h-11',
        lg: 'h-11 px-6',
        icon: 'size-9 max-md:size-11',
        'icon-sm': 'size-8 max-md:size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      data-variant={variant ?? 'default'}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
