/**
 * Pure image-path helpers.
 *
 * Foundry can rewrite a stored `texture.src` (percent-encoding, cache-busting
 * query strings, backslashes on Windows, trailing slashes), so a raw `===`
 * comparison between two references to the *same* file is unreliable. We compare
 * on a normalized form instead.
 */

/**
 * Normalize a path/URL for equality comparison. Never throws.
 * @param {unknown} src
 * @returns {string}
 */
export function normalizePath(src) {
  if (!src || typeof src !== "string") return "";
  let s = src.trim();

  // Drop query string / hash fragment (e.g. cache-busting "?123").
  const cut = s.search(/[?#]/);
  if (cut !== -1) s = s.slice(0, cut);

  // Best-effort percent-decoding.
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep raw */
  }

  // Windows backslashes -> forward slashes; drop trailing slashes.
  s = s.replace(/\\/g, "/").replace(/\/+$/, "");

  return s;
}

/**
 * True when two paths reference the same file after normalization.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function samePath(a, b) {
  const na = normalizePath(a);
  const nb = normalizePath(b);
  return na !== "" && na === nb;
}
