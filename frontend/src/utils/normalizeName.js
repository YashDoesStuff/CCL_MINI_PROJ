/**
 * normalizeName.js
 * Strips common academic honorifics from a display name.
 * "Prof. Sohan Agate" → "Sohan Agate"
 * "Dr. M. VeeraBhadra Rao" → "M. VeeraBhadra Rao"
 */

const HONORIFIC_PATTERN =
  /^(Prof\.|Professor|Dr\.|Dr|Mr\.|Mr|Mrs\.|Mrs|Ms\.|Ms|Sir|Madam|Shri|Smt)\s+/i;

export function normalizeName(name = '') {
  if (!name) return '';
  return name.replace(HONORIFIC_PATTERN, '').trim();
}
