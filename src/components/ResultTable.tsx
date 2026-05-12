import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';
import type { QueryResult } from '../db/engine';
import { formatCell, isNumeric, sortKey, typeLabel } from '../lib/format';
import { sortOrder, type SortSpec } from '../lib/sort';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 44;
const CELL_FONT = '12px "IBM Plex Mono"';

let measuredCharWidth: number | null = null;

/** Width of one monospace character in the cell font, measured once the font has loaded. */
function charWidth(): number {
  if (measuredCharWidth !== null) return measuredCharWidth;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return 7.4;
  context.font = CELL_FONT;
  const width = context.measureText('0'.repeat(20)).width / 20;
  if (document.fonts.check(CELL_FONT)) measuredCharWidth = width;
  return width;
}
const MIN_WIDTH = 72;
const MAX_WIDTH = 420;
const INDEX_WIDTH = 64;

function SortArrow({ direction }: { direction: 'asc' | 'desc' | null }) {
  return (
    <svg
      viewBox="0 0 10 12"
      aria-hidden
      className={`h-3 w-2.5 shrink-0 ${direction ? 'fill-accent' : 'fill-faint opacity-0 group-hover:opacity-100'}`}
    >
      {direction === 'desc' ? <path d="M5 11L1 5h8z" /> : <path d="M5 1l4 6H1z" />}
    </svg>
  );
}

/**
 * Result grid that only renders the rows in view, so 100,000 rows scroll as
 * smoothly as 10. Cells are read straight from Arrow columns on demand.
 */
export function ResultTable({
  result,
  sort,
  sortedByDatabase,
  onSort,
}: {
  result: QueryResult;
  sort: SortSpec | null;
  /** If true the rows already arrive sorted and must not be reordered here. */
  sortedByDatabase: boolean;
  onSort: (column: number) => void;
}) {
  const { table } = result;
  const fields = table.schema.fields;
  const scroller = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => fields.map((_, i) => table.getChildAt(i)!), [table, fields]);

  // Size each column from its header and a sample of its values.
  const widths = useMemo(() => {
    // Sample rows spread across the whole result, not just the first few.
    const step = Math.max(1, Math.floor(table.numRows / 60));
    return fields.map((field, c) => {
      let chars = Math.max(field.name.length, typeLabel(field.type).length) + 3;
      for (let r = 0; r < table.numRows; r += step) {
        chars = Math.max(chars, (formatCell(columns[c].get(r), field.type) ?? 'NULL').length);
      }
      return Math.ceil(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, chars * charWidth() + 28)));
    });
  }, [table, fields, columns]);
  const totalWidth = INDEX_WIDTH + widths.reduce((sum, w) => sum + w, 0);

  const order = useMemo(() => {
    if (!sort || sortedByDatabase) return null;
    const column = columns[sort.column];
    const type = fields[sort.column].type;
    const keys = Array.from({ length: table.numRows }, (_, r) => sortKey(column.get(r), type));
    return sortOrder(keys, sort.direction);
  }, [sort, sortedByDatabase, columns, fields, table]);

  const virtualizer = useVirtualizer({
    count: table.numRows,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  return (
    <div ref={scroller} className="h-full overflow-auto bg-panel">
      <div
        role="table"
        data-testid="result-table"
        aria-rowcount={table.numRows + 1}
        style={{ width: totalWidth, height: HEADER_HEIGHT + virtualizer.getTotalSize() }}
        className="relative text-[12px]"
      >
        <div
          role="row"
          style={{ height: HEADER_HEIGHT }}
          className="sticky top-0 z-20 flex border-b border-ink bg-panel"
        >
          <div
            role="columnheader"
            style={{ width: INDEX_WIDTH }}
            className="sticky left-0 z-10 shrink-0 bg-panel"
          />
          {fields.map((field, c) => {
            const direction = sort?.column === c ? sort.direction : null;
            return (
              <div
                key={c}
                role="columnheader"
                aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
                style={{ width: widths[c] }}
                className="shrink-0"
              >
                <button
                  type="button"
                  aria-label={`Sort by ${field.name}`}
                  onClick={() => onSort(c)}
                  className={`group flex h-full w-full flex-col justify-center px-3 hover:bg-wash ${isNumeric(field.type) ? 'items-end' : 'items-start'}`}
                >
                  <span className="flex max-w-full items-center gap-1">
                    <span className="truncate font-mono text-[12px] font-semibold">{field.name}</span>
                    <SortArrow direction={direction} />
                  </span>
                  <span className="font-mono text-[10.5px] leading-tight text-faint">{typeLabel(field.type)}</span>
                </button>
              </div>
            );
          })}
        </div>

        {virtualizer.getVirtualItems().map((item) => {
          const row = order ? order[item.index] : item.index;
          return (
            <div
              key={item.index}
              role="row"
              aria-rowindex={item.index + 2}
              style={{ height: ROW_HEIGHT, top: HEADER_HEIGHT + item.start }}
              className="absolute left-0 flex w-full border-b border-rule/60 bg-panel hover:bg-wash"
            >
              <div
                style={{ width: INDEX_WIDTH }}
                className="sticky left-0 z-10 shrink-0 bg-inherit px-3 text-right font-mono text-[11px] leading-7 text-faint tabular-nums select-none"
              >
                {(item.index + 1).toLocaleString('en-US')}
              </div>
              {fields.map((field, c) => {
                const text = formatCell(columns[c].get(row), field.type);
                return (
                  <div
                    key={c}
                    role="cell"
                    style={{ width: widths[c] }}
                    title={text !== null && text.length > 30 ? text : undefined}
                    className={`shrink-0 truncate px-3 font-mono leading-7 ${isNumeric(field.type) ? 'text-right tabular-nums' : ''}`}
                  >
                    {text === null ? <span className="text-faint">NULL</span> : text}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
