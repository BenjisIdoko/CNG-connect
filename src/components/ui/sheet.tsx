import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/** A side drawer built on Radix Dialog; the admin uses it for the phone navigation. */
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetContent({
  className,
  children,
  side = 'left',
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: 'left' | 'right'; showCloseButton?: boolean }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay data-slot="sheet-overlay" className="fixed inset-0 z-[230] bg-adm-note/55" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'admin-ui fixed inset-y-0 z-[240] flex h-full w-[min(20rem,85vw)] flex-col outline-none shadow-[0_0_32px_rgba(13,59,46,0.3)]',
          side === 'left' ? 'left-0' : 'right-0',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-3 right-3 rounded-md p-1 text-adm-note-text hover:bg-adm-note-2 focus-visible:ring-2 focus-visible:ring-adm-foil outline-none">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Close menu</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn('font-geist font-bold', className)} {...props} />;
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn('sr-only', className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
