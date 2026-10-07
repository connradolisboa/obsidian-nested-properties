import type { GenericObject } from 'obsidian-dev-utils/TypeGuards';

import { moment as momentModule } from 'obsidian';
import { extractDefaultExportInterop } from 'obsidian-dev-utils/ObjectUtils';

const moment = extractDefaultExportInterop(momentModule);

const MAX_SUMMARY_LENGTH = 120;

export function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export function convertValue(targetType: string, value: unknown): unknown {
  switch (targetType) {
    case 'aliases':
    case 'multitext':
    case 'tags':
      return convertToSimpleList(value);
    case 'checkbox':
      return Boolean(value);
    case 'date':
    case 'datetime':
      return typeof value === 'string' && value && moment(value).isValid() ? value : null;
    case 'list':
      return convertToMixedList(value);
    case 'number':
      return Number(convertToString(value)) || 0;
    case 'object':
      return isPlainObject(value) ? value : {};
    default:
      return isComplexValue(value) ? JSON.stringify(value) : convertToString(value);
  }
}

/**
 * One-line rendition of a complex value shown while it is collapsed. Nested complex values are elided so the
 * row stays one line tall.
 */
export function formatValueSummary(value: unknown): string {
  if (Array.isArray(value)) {
    return joinSummary('[', value.map(formatSummaryItem), ']');
  }
  if (isPlainObject(value)) {
    return joinSummary('{', Object.entries(value).map(([key, item]) => `${key}: ${formatSummaryItem(item)}`), '}');
  }
  return formatSummaryScalar(value);
}

export function getTableColumns(rows: GenericObject[]): string[] {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) {
        columns.push(key);
      }
    }
  }
  return columns;
}

export function isComplexValue(value: unknown): value is GenericObject | unknown[] {
  return value !== null && typeof value === 'object' && !(value instanceof Date);
}

export function isLossyConversion(targetType: string, value: unknown): boolean {
  switch (targetType) {
    case 'aliases':
    case 'multitext':
    case 'tags':
      return !isSimpleArray(value);
    case 'list':
      return !Array.isArray(value);
    case 'object':
      return !isPlainObject(value);
    default:
      return isComplexValue(value);
  }
}

export function isPlainObject(value: unknown): value is GenericObject {
  return isComplexValue(value) && !Array.isArray(value);
}

export function isSimpleArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.every((item) => !isComplexValue(item));
}

/**
 * An array that reads naturally as a table: every item is an object whose values are all scalars.
 */
export function isTableArray(value: unknown): value is GenericObject[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => isPlainObject(item) && Object.values(item).every((cell) => !isComplexValue(cell)));
}

export function moveItem(arr: unknown[], index: number, offset: number): void {
  const to = index + offset;
  if (to < 0 || to >= arr.length) {
    return;
  }
  const [item] = arr.splice(index, 1);
  arr.splice(to, 0, item);
}

/**
 * Returns a copy of `obj` with `key` moved by `offset` positions.
 */
export function moveKey(obj: GenericObject, key: string, offset: number): GenericObject {
  const keys = Object.keys(obj);
  const from = keys.indexOf(key);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= keys.length) {
    return obj;
  }
  keys.splice(from, 1);
  keys.splice(to, 0, key);
  const result: GenericObject = {};
  for (const k of keys) {
    result[k] = obj[k];
  }
  return result;
}

/**
 * Returns a copy of `obj` with `oldKey` renamed to `newKey`, keeping the key's position.
 */
export function renameKey(obj: GenericObject, oldKey: string, newKey: string): GenericObject {
  const result: GenericObject = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key === oldKey ? newKey : key] = value;
  }
  return result;
}

/**
 * Replaces the contents of `target` with the contents of `source` in place, so references to `target` stay valid.
 */
export function replaceObjectContents(target: GenericObject, source: GenericObject): void {
  for (const key of Object.keys(target)) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Need to delete the key.
    delete target[key];
  }
  Object.assign(target, source);
}

function convertToMixedList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === null || value === undefined || value === '' ? [] : [value];
}

function convertToSimpleList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.filter((item) => !isComplexValue(item));
  }
  if (isComplexValue(value)) {
    return [];
  }
  const str = convertToString(value);
  return str ? [str] : [];
}

function convertToString(value: unknown): string {
  if (value instanceof Date) {
    return moment(value).format('YYYY-MM-DD');
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- Scalars only.
  return String(value ?? '');
}

function formatSummaryItem(value: unknown): string {
  if (Array.isArray(value)) {
    return '[…]';
  }
  return isComplexValue(value) ? '{…}' : formatSummaryScalar(value);
}

function formatSummaryScalar(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? '✓' : '✗';
  }
  return convertToString(value);
}

function joinSummary(open: string, entries: string[], close: string): string {
  if (entries.length === 0) {
    return `${open}${close}`;
  }
  const body = entries.join(', ');
  return body.length > MAX_SUMMARY_LENGTH ? `${body.slice(0, MAX_SUMMARY_LENGTH)}…` : body;
}
