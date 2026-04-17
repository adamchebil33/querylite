import { DataType } from 'apache-arrow';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const millis = d.getUTCMilliseconds();
  return `${formatDate(ms)} ${time}${millis ? `.${pad(millis, 3)}` : ''}`;
}

/** Arrow hands decimals back as unscaled integers; put the decimal point back. */
export function formatDecimal(unscaled: bigint, scale: number): string {
  if (scale <= 0) return unscaled.toString();
  const negative = unscaled < 0n;
  const digits = (negative ? -unscaled : unscaled).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, -scale);
  return `${negative ? '-' : ''}${whole}.${digits.slice(-scale)}`;
}

/** Arrow stores a decimal as little-endian 32-bit words (two's complement). */
export function decimalToBigInt(words: ArrayLike<number>): bigint {
  let value = 0n;
  for (let i = words.length - 1; i >= 0; i--) value = (value << 32n) | BigInt(words[i] >>> 0);
  const bits = BigInt(words.length * 32);
  return value >= 1n << (bits - 1n) ? value - (1n << bits) : value;
}

function toPlain(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<unknown>, toPlain);
  if (Symbol.iterator in value && !('toJSON' in value)) {
    return Array.from(value as Iterable<unknown>, toPlain);
  }
  const json = 'toJSON' in value ? (value as { toJSON(): unknown }).toJSON() : value;
  if (Array.isArray(json)) return json.map(toPlain);
  if (json !== null && typeof json === 'object') {
    return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, toPlain(v)]));
  }
  return json;
}

/** Formats one result cell for display. Returns null for SQL NULL. */
export function formatCell(value: unknown, type: DataType): string | null {
  if (value === null || value === undefined) return null;
  if (DataType.isDecimal(type)) {
    return formatDecimal(decimalToBigInt(value as ArrayLike<number>), type.scale);
  }
  if (DataType.isDate(type)) return formatDate(Number(value));
  if (DataType.isTimestamp(type)) return formatTimestamp(Number(value));
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Uint8Array && DataType.isBinary(type)) {
    return `\\x${Array.from(value.subarray(0, 32), (b) => pad(Number(b.toString(16)))).join('')}`;
  }
  return JSON.stringify(toPlain(value));
}

/**
 * A value that sorts correctly with plain comparisons: numbers, bigints,
 * booleans and strings stay as they are, decimals become bigints, and
 * anything nested is compared by its display text.
 */
export function sortKey(value: unknown, type: DataType): unknown {
  if (value === null || value === undefined) return null;
  if (DataType.isDecimal(type)) return decimalToBigInt(value as ArrayLike<number>);
  if (typeof value === 'object') return formatCell(value, type);
  return value;
}

/** A plain number for charting; NaN if the value isn't numeric. */
export function toNumber(value: unknown, type: DataType): number {
  if (value === null || value === undefined) return NaN;
  if (DataType.isDecimal(type)) {
    return Number(formatDecimal(decimalToBigInt(value as ArrayLike<number>), type.scale));
  }
  return typeof value === 'number' || typeof value === 'bigint' ? Number(value) : NaN;
}

/** A short SQL-style name for a column type, e.g. "bigint" or "decimal(10,2)". */
export function typeLabel(type: DataType): string {
  if (DataType.isInt(type)) {
    const name = { 8: 'tinyint', 16: 'smallint', 32: 'integer', 64: 'bigint' }[type.bitWidth];
    return `${type.isSigned ? '' : 'u'}${name ?? 'integer'}`;
  }
  if (DataType.isFloat(type)) return type.precision === 2 ? 'double' : 'float';
  if (DataType.isDecimal(type)) return `decimal(${type.precision},${type.scale})`;
  if (DataType.isUtf8(type) || DataType.isLargeUtf8(type)) return 'text';
  if (DataType.isBool(type)) return 'boolean';
  if (DataType.isDate(type)) return 'date';
  if (DataType.isTimestamp(type)) return 'timestamp';
  if (DataType.isTime(type)) return 'time';
  if (DataType.isList(type)) return 'list';
  if (DataType.isStruct(type)) return 'struct';
  if (DataType.isBinary(type)) return 'blob';
  return String(type).toLowerCase();
}

/** Whether values of this type read best right-aligned. */
export function isNumeric(type: DataType): boolean {
  return DataType.isInt(type) || DataType.isFloat(type) || DataType.isDecimal(type);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatCount(n: number, noun: string): string {
  return `${n.toLocaleString('en-US')} ${noun}${n === 1 ? '' : 's'}`;
}
