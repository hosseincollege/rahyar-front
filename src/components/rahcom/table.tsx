import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type RahcomTableFrameProps = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
};

/** Shared Rahcom table frame and scrolling viewport. */
export function RahcomTableFrame({ children, className = '', viewportClassName = '' }: RahcomTableFrameProps) {
  return (
    <div className={`rahcom-table-frame flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card ${className}`}>
      <div className={`rahcom-table-scroll min-h-0 min-w-0 flex-1 overflow-auto ${viewportClassName}`}>
        {children}
      </div>
    </div>
  );
}

type RahcomTableCountProps = {
  children: ReactNode;
  label: string;
  title?: string;
};

/** Shared count capsule for Rahcom data tables. */
export function RahcomTableCount({ children, label, title }: RahcomTableCountProps) {
  return (
    <span role="status" aria-label={label} title={title} className="rahcom-table-count inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-bold tabular-nums text-foreground">
      {children}
    </span>
  );
}

/** Shared Rahcom table. Its visual rules live in the global Rahcom theme styles. */
export const RahcomTable = forwardRef<HTMLTableElement, ComponentPropsWithoutRef<'table'>>(
  function RahcomTable({ className = '', ...props }, ref) {
    return <table {...props} ref={ref} className={`rahcom-table ${className}`} />;
  },
);

RahcomTable.displayName = 'RahcomTable';
