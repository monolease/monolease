/**
 * To maintain type safety, only create assert functions that asserts a built-in type
 * If asserting a custom type, there's no way to ensure that we remember to update
 * the assert function when the type changes, resulting in the assert function
 * performing as a type cast. Instead, add a parse function that returns the type
 * you want to assert.
 */
import {gitAbbrevHashRegex} from '../constants.js';

export function isObject(x: unknown): x is Record<PropertyKey, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function isNonNullable<T>(x: T): x is NonNullable<T> {
  return x !== null && typeof x !== 'undefined';
}

/**
 * Asserts that the given value is an unknown array.
 * Use this instead of Array.isArray to avoid the unsafe any type.
 */
export function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

export function isStringArray(x: unknown): x is string[] {
  return isArray(x) && x.every(item => typeof item === 'string');
}

export function isStringRecord(x: unknown): x is Record<string, string> {
  return (
    isObject(x) &&
    Object.entries(x).every(
      ([key, value]) => typeof key === 'string' && typeof value === 'string',
    )
  );
}

export function isAbbrevHash(x: unknown): x is string {
  if (typeof x !== 'string') {
    return false;
  }

  if (!gitAbbrevHashRegex.test(x)) {
    return false;
  }

  return true;
}
