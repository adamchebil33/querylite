import { DataType, type Table } from 'apache-arrow';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  allowedTypes,
  formatTick,
  tickFormatter,
  MAX_BARS,
  MAX_POINTS,
  MAX_SERIES,
  suggestChart,
  thin,
  type ChartColumn,
  type ChartSpec,
  type ChartType,
  type ColumnKind,
  type DataProbe,
} from '../lib/chart';
import { formatCell, isNumeric, toNumber } from '../lib/format';

type Row = Record<string, unknown>;

const SERIES_COLORS = Array.from({ length: MAX_SERIES }, (_, i) => `var(--chart-${i + 1})`);
/** A lone series has no identity to encode, so it is drawn in ink. */
const SOLO_COLOR = 'var(--chart-solo)';
const TYPE_LABELS: Record<ChartType, string> = { bar: 'Bar', line: 'Line', scatter: 'Scatter' };

function kindOf(type: DataType): ColumnKind {
  if (isNumeric(type)) return 'number';
  if (DataType.isDate(type) || DataType.isTimestamp(type)) return 'time';
  if (DataType.isUtf8(type) || DataType.isLargeUtf8(type) || DataType.isBool(type)) return 'text';
  return 'other';
}

export function chartColumns(table: Table): ChartColumn[] {
  return table.schema.fields.map((field) => ({ name: field.name, kind: kindOf(field.type) }));
}

function makeProbe(table: Table): DataProbe {
  return {
    isUnique(column) {
      const vector = table.getChildAt(column)!;
      const type = table.schema.fields[column].type;
      const seen = new Set<string | null>();
      for (let r = 0; r < table.numRows; r++) {
        const key = formatCell(vector.get(r), type);
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    },
    maxAbs(column) {
      const vector = table.getChildAt(column)!;
      const type = table.schema.fields[column].type;
      let max = 0;
      for (let r = 0; r < table.numRows; r++) {
        const value = Math.abs(toNumber(vector.get(r), type));
        if (value > max) max = value;
      }
      return max;
    },
  };
}

/** The default chart for a result, or null if it can't be charted. */
export function defaultChart(table: Table): ChartSpec | null {
  return suggestChart(chartColumns(table), table.numRows, makeProbe(table));
}

const shorten = (text: string, max = 26) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Pulls the rows a chart needs out of the Arrow table as plain objects. */
function prepare(table: Table, spec: ChartSpec) {
  const fields = table.schema.fields;
  const xField = fields[spec.x];
  const xKind = kindOf(xField.type);
  const xVector = table.getChildAt(spec.x)!;
  const categorical = spec.type === 'bar';
  const series = (spec.type === 'line' ? spec.y : spec.y.slice(0, 1)).map((index) => ({
    index,
    name: fields[index].name,
  }));
  const labelColumn =
    spec.type === 'scatter' ? fields.findIndex((f) => kindOf(f.type) === 'text') : -1;

  const limit = spec.type === 'bar' ? MAX_BARS : MAX_POINTS;
  const picked =
    spec.type === 'bar'
      ? Array.from({ length: Math.min(table.numRows, limit) }, (_, i) => i)
      : thin(table.numRows, limit);

  const rows: Row[] = [];
  for (const r of picked) {
    const raw = xVector.get(r);
    let x: unknown;
    if (categorical) x = formatCell(raw, xField.type) ?? 'NULL';
    else if (xKind === 'time') x = raw === null ? null : new Date(Number(raw));
    else x = toNumber(raw, xField.type);
    if (x === null || (typeof x === 'number' && Number.isNaN(x))) continue;

    const row: Row = { x };
    let hasValue = false;
    for (const s of series) {
      const value = toNumber(table.getChildAt(s.index)!.get(r), fields[s.index].type);
      row[s.name] = Number.isNaN(value) ? null : value;
      hasValue ||= !Number.isNaN(value);
    }
    if (!hasValue) continue;
    if (labelColumn >= 0) {
      row.label = formatCell(table.getChildAt(labelColumn)!.get(r), fields[labelColumn].type);
    }
    rows.push(row);
  }
  return { rows, series, xName: xField.name, xKind, shown: picked.length };
}

function Plot({ table, spec }: { table: Table; spec: ChartSpec }) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const data = useMemo(() => prepare(table, spec), [table, spec]);

  useEffect(() => {
    const element = host.current!;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.width < 120 || size.height < 120) return;
    let stale = false;
    // The charting library is only downloaded when a chart is first drawn.
    import('@observablehq/plot')
      .then((P) => {
        if (stale) return;
        const { rows, series, xName, xKind } = data;
        const first = series[0].name;
        const seriesColor = (i: number) => (series.length === 1 ? SOLO_COLOR : SERIES_COLORS[i]);
        const grid = { stroke: 'var(--chart-grid)', strokeOpacity: 1 };
        const axis = { stroke: 'var(--chart-axis)' };
        const horizontalBars = spec.type === 'bar' && xKind === 'text';
        const tipStyle = { fill: 'var(--chart-surface)', stroke: 'var(--chart-axis)' };
        const marks = [];
        let height = size.height;
        let marginLeft = 56;
        let marginBottom = 40;

        if (horizontalBars) {
          // One row per label, in the order the query returned them.
          const longest = Math.max(...rows.map((row) => shorten(String(row.x)).length));
          marginLeft = Math.min(220, Math.round(longest * 6.6) + 16);
          height = Math.max(size.height, rows.length * 30 + 60);
          const band = (height - 60) / Math.max(1, rows.length);
          const inset = Math.max(1, (band - 22) / 2);
          marks.push(
            P.gridX(grid),
            P.barX(rows, {
              x: first,
              y: 'x',
              fill: SOLO_COLOR,
              insetTop: inset,
              insetBottom: inset,
              tip: { format: { y: true, x: true }, ...tipStyle },
            }),
            P.ruleX([0], axis),
          );
          if (rows.length <= 15) {
            marks.push(
              P.text(rows, {
                x: first,
                y: 'x',
                text: (row: Row) => formatTick(row[first] as number),
                textAnchor: 'start',
                dx: 6,
                fill: 'var(--chart-text)',
              }),
            );
          }
        } else if (spec.type === 'bar') {
          const band = (size.width - marginLeft - 20) / Math.max(1, rows.length);
          const inset = Math.max(1, (band - 24) / 2);
          marks.push(
            P.gridY(grid),
            P.barY(rows, {
              x: 'x',
              y: first,
              fill: SOLO_COLOR,
              insetLeft: inset,
              insetRight: inset,
              tip: tipStyle,
            }),
            P.ruleY([0], axis),
          );
        } else if (spec.type === 'line') {
          marks.push(P.gridY(grid), P.ruleY([0], axis));
          series.forEach((s, i) => {
            marks.push(
              P.lineY(rows, {
                x: 'x',
                y: s.name,
                stroke: seriesColor(i),
                strokeWidth: 2,
                strokeLinejoin: 'round',
                strokeLinecap: 'round',
              }),
            );
          });
          // Crosshair plus one tooltip listing every series at that position.
          marks.push(
            P.ruleX(rows, P.pointerX({ x: 'x', stroke: 'var(--chart-axis)' })),
            ...series.map((s, i) =>
              P.dot(
                rows,
                P.pointerX({
                  x: 'x',
                  y: s.name,
                  r: 4,
                  fill: seriesColor(i),
                  stroke: 'var(--chart-surface)',
                  strokeWidth: 2,
                }),
              ),
            ),
            P.tip(
              rows,
              P.pointerX({
                x: 'x',
                y: first,
                channels: Object.fromEntries(series.map((s) => [s.name, s.name])),
                format: { y: false },
                ...tipStyle,
              }),
            ),
          );
        } else {
          marks.push(
            P.gridX(grid),
            P.gridY(grid),
            P.dot(rows, {
              x: 'x',
              y: first,
              r: 4,
              fill: SOLO_COLOR,
              fillOpacity: 0.75,
              stroke: 'var(--chart-surface)',
              strokeWidth: 1.5,
              channels: rows.some((row) => row.label) ? { label: 'label' } : undefined,
              tip: tipStyle,
            }),
          );
        }

        const maxOf = (keys: string[]) =>
          Math.max(0, ...rows.flatMap((row) => keys.map((k) => Math.abs(Number(row[k]) || 0))));
        const valueAxis = {
          tickFormat: tickFormatter(maxOf(series.map((s) => s.name))),
          labelArrow: 'none' as const,
        };
        const numericX = { tickFormat: tickFormatter(maxOf(['x'])), labelArrow: 'none' as const };
        // On a narrow chart, label every second (third...) bar so the labels don't run together.
        const labelWidth = Math.max(0, ...rows.map((row) => String(row.x).length)) * 7.5 + 4;
        const bandWidth = (size.width - marginLeft - 20) / Math.max(1, rows.length);
        const labelEvery = Math.max(1, Math.ceil(labelWidth / bandWidth));
        const svg = P.plot({
          width: size.width,
          height,
          marginLeft,
          marginBottom,
          marginRight: horizontalBars ? 48 : 20,
          marginTop: 30,
          style: {
            background: 'transparent',
            color: 'var(--chart-text)',
            fontSize: '12px',
            fontFamily: 'inherit',
            overflow: 'visible',
          },
          x: horizontalBars
            ? { ...valueAxis, label: first }
            : spec.type === 'bar'
              ? { label: xName, type: 'band' as const, domain: rows.map((r) => r.x as string), ticks: rows.filter((_, i) => i % labelEvery === 0).map((r) => r.x as string) }
              : xKind === 'time'
                ? { label: null }
                : { ...numericX, label: xName },
          y: horizontalBars
            ? { label: null, tickFormat: (value: string) => shorten(value), domain: rows.map((r) => r.x as string) }
            : {
                ...valueAxis,
                label: series.length === 1 ? first : null,
                nice: true,
                zero: spec.type !== 'scatter',
              },
          marks,
        });
        host.current?.replaceChildren(svg);
        setFailed(false);
      })
      .catch(() => {
        if (!stale) setFailed(true);
      });
    return () => {
      stale = true;
    };
  }, [data, spec, size]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {data.series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-1 font-mono text-[11px] text-muted">
          {data.series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ background: SERIES_COLORS[i] }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        <div ref={host} data-testid="chart" className="h-full w-full" />
      </div>
      {failed && <p className="px-3 pb-2 text-xs text-danger">The chart could not be drawn.</p>}
      {data.shown < table.numRows && (
        <p className="px-3 pb-2 font-mono text-[11px] text-faint">
          {spec.type === 'bar'
            ? `Showing the first ${data.shown} of ${table.numRows.toLocaleString('en-US')} rows.`
            : `Showing ${data.shown.toLocaleString('en-US')} evenly spaced points of ${table.numRows.toLocaleString('en-US')}.`}
        </p>
      )}
    </div>
  );
}

const selectClass =
  'max-w-40 border border-rule bg-panel px-1 py-0.5 font-mono text-[12px] text-ink normal-case tracking-normal';

/** A chart of the current result with controls to change its type and columns. */
export function ChartPanel({ table, initial }: { table: Table; initial: ChartSpec }) {
  const [spec, setSpec] = useState(initial);
  const columns = useMemo(() => chartColumns(table), [table]);
  const numbers = columns.flatMap((c, i) => (c.kind === 'number' ? [i] : []));
  const xChoices = columns.flatMap((c, i) => (c.kind !== 'other' ? [i] : []));
  const types = allowedTypes(columns[spec.x].kind);
  const multi = spec.type === 'line' && initial.type === 'line' && initial.y.length > 1;
  const yValue = multi && spec.y.length > 1 ? 'all' : String(spec.y[0]);

  const setX = (x: number) => {
    const allowed = allowedTypes(columns[x].kind);
    const y = spec.y.filter((i) => i !== x);
    setSpec({
      type: allowed.includes(spec.type) ? spec.type : allowed[0],
      x,
      y: y.length > 0 ? y : [numbers.find((i) => i !== x) ?? numbers[0]],
    });
  };

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <div role="group" aria-label="Chart type" className="flex border border-rule">
          {types.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={spec.type === type}
              onClick={() => setSpec({ ...spec, type })}
              className={`px-2 py-0.5 text-[12px] font-medium ${
                spec.type === type ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <label className="label flex items-center gap-1.5">
          X
          <select
            aria-label="Chart X column"
            className={selectClass}
            value={spec.x}
            onChange={(event) => setX(Number(event.target.value))}
          >
            {xChoices.map((i) => (
              <option key={i} value={i}>
                {columns[i].name}
              </option>
            ))}
          </select>
        </label>
        <label className="label flex items-center gap-1.5">
          Y
          <select
            aria-label="Chart Y column"
            className={selectClass}
            value={yValue}
            onChange={(event) =>
              setSpec({
                ...spec,
                y: event.target.value === 'all' ? initial.y : [Number(event.target.value)],
              })
            }
          >
            {multi && <option value="all">{initial.y.map((i) => columns[i].name).join(', ')}</option>}
            {numbers
              .filter((i) => i !== spec.x)
              .map((i) => (
                <option key={i} value={i}>
                  {columns[i].name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <Plot table={table} spec={spec} />
    </div>
  );
}
