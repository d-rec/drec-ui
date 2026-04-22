/**
 * Extract a file extension (lowercased) from a URL or filename.
 *
 * Returns `''` when the input has no dot-suffix, when the suffix is longer
 * than 6 chars (not a real extension — probably the tail end of a path with
 * a dot in it), or when it contains anything outside `[a-z0-9]`.
 *
 * Implemented without a regex to avoid SonarCloud's super-linear-backtracking
 * false positive on `/\.([a-z0-9]{1,6})$/i`. The bounded repetition was safe,
 * but this is simpler and skips the argument.
 */
export function extractExt(source: string | null | undefined): string {
  if (!source) return '';
  const qIdx = source.indexOf('?');
  const path = qIdx === -1 ? source : source.slice(0, qIdx);
  const lastDot = path.lastIndexOf('.');
  if (lastDot < 0 || lastDot === path.length - 1) return '';
  const ext = path.slice(lastDot + 1);
  if (ext.length < 1 || ext.length > 6) return '';
  for (let i = 0; i < ext.length; i++) {
    const c = ext.charCodeAt(i);
    const isDigit = c >= 48 && c <= 57; //  0-9
    const isLower = c >= 97 && c <= 122; // a-z
    const isUpper = c >= 65 && c <= 90; //  A-Z
    if (!isDigit && !isLower && !isUpper) return '';
  }
  return ext.toLowerCase();
}
