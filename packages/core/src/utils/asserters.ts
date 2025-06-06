/**
 * To maintain type safety, only create assert functions that asserts a built-in type
 * If asserting a custom type, there's no way to ensure that we remember to update
 * the assert function when the type changes, resulting in the assert function
 * performing as a type cast. Instead, add a parse function that returns the type
 * you want to assert.
 */
import {gitAbbrevHashRegex} from '../constants.js';

export function isAbbrevHash(x: unknown): x is string {
  return typeof x === 'string' && gitAbbrevHashRegex.test(x);
}
