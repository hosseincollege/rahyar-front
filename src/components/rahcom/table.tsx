import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type TableRowPosition = { key: string; top: number };
type TablePosition = { table: HTMLTableElement; columns: string[]; rows: TableRowPosition[] };

function readTablePositions(): TablePosition[] {
  return [...document.querySelectorAll<HTMLTableElement>('table.rahcom-sticky-table')].map((table) => ({
    table,
    columns: [...(table.tHead?.rows[0]?.cells ?? [])].map((cell) => cell.innerText.trim()),
    rows: (() => {
      const occurrences = new Map<string, number>();
      return [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')].map((row) => {
        const keyBase = row.querySelector<HTMLElement>('td.font-mono')?.innerText.trim()
          || row.cells.item(0)?.innerText.trim()
          || row.innerText.trim();
        const occurrence = occurrences.get(keyBase) ?? 0;
        occurrences.set(keyBase, occurrence + 1);
        return { key: `${keyBase}\u0000${occurrence}`, top: row.getBoundingClientRect().top };
      });
    })(),
  }));
}

/** Animate row filtering and column changes consistently for every Rahcom table. */
export function animateRahcomTableChange(update: () => void) {
  if (typeof document === 'undefined') {
    update();
    return;
  }

  const before = readTablePositions();
  if (!before.length || typeof Element.prototype.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }

  const fadeOuts = before.map(({ table }) => table.animate(
    [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0.35, transform: 'translateY(4px)' }],
    { duration: 90, easing: 'ease-out', fill: 'forwards' },
  ));

  void Promise.all(fadeOuts.map((animation) => animation.finished.catch(() => undefined))).then(() => {
    update();
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const after = readTablePositions();
      after.forEach(({ table, columns, rows }, tableIndex) => {
        fadeOuts[tableIndex]?.cancel();
        table.animate(
          [{ opacity: 0.35, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 180, easing: 'ease-out' },
        );

        const priorColumns = new Set(before[tableIndex]?.columns ?? []);
        columns.forEach((column, columnIndex) => {
          if (priorColumns.has(column)) return;
          const header = table.tHead?.rows[0]?.cells.item(columnIndex);
          const cells = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')]
            .map((row) => row.cells.item(columnIndex))
            .filter((cell): cell is HTMLTableCellElement => Boolean(cell));
          [header, ...cells].forEach((cell) => cell?.animate(
            [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 180, easing: 'ease-out' },
          ));
        });

        const priorRows = new Map((before[tableIndex]?.rows ?? []).map((row) => [row.key, row.top]));
        const elements = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')];
        rows.forEach((row, index) => {
          const element = elements[index];
          if (!element) return;
          const oldTop = priorRows.get(row.key);
          const offset = oldTop === undefined ? 8 : oldTop - row.top;
          if (oldTop === undefined || Math.abs(offset) > 1) {
            element.animate(
              [{ opacity: oldTop === undefined ? 0 : 0.55, transform: `translateY(${offset}px)` }, { opacity: 1, transform: 'translateY(0)' }],
              { duration: 190, easing: 'ease-out' },
            );
          }
        });
      });
    }));
  });
}

type RahcomTableFrameProps = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  /** Cap the table frame to the available screen height so long tables scroll inside the frame. */
  bounded?: boolean;
};

/** Shared Rahcom table frame and scrolling viewport. */
export function RahcomTableFrame({ children, className = '', viewportClassName = '', bounded = false }: RahcomTableFrameProps) {
  return (
    <div className={`rahcom-table-frame flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card ${bounded ? 'rahcom-table-frame--bounded' : ''} ${className}`}>
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
  count?: number;
};

/** Shared count capsule for Rahcom data tables. */
export function RahcomTableCount({ children, label, title, count }: RahcomTableCountProps) {
  return (
      <span role="status" aria-label={label} title={title} data-count={count} className="rahcom-table-count inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-bold tabular-nums text-foreground">
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
