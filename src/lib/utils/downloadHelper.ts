/**
 * Safe File Download Helper with Controlled Object URL Cleanup
 * Prevents premature revocation errors and memory leaks across browsers.
 */

export function downloadBlobWithCleanup(blob: Blob, fileName: string): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.setAttribute('target', '_blank');
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Keep URL active longer (60 seconds) so user can click fallback links if needed
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);

  return url;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sanitizes filenames across Windows, macOS, and Linux
 * Handles special characters, accents, slashes, colons, emojis, and reserved system filenames.
 */
export function sanitizeFilename(name: string, fallback: string = 'omnia-livro'): string {
  if (!name) return fallback;

  // Normalize Unicode
  let clean = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Remove invalid filename characters: / \ : * ? " < > |
  clean = clean.replace(/[/\\?%*:|"<>]/g, '-');

  // Replace spaces and consecutive dashes
  clean = clean.replace(/\s+/g, '-').replace(/-+/g, '-').trim();

  // Check for OS reserved filenames (Windows CON, PRN, AUX, NUL, COM1, LPT1, etc)
  const reservedRegex = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (reservedRegex.test(clean) || clean.length === 0) {
    clean = `${fallback}-${clean || 'doc'}`;
  }

  // Truncate length
  if (clean.length > 80) {
    clean = clean.substring(0, 80);
  }

  return clean.toLowerCase();
}
