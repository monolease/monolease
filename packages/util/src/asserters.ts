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
