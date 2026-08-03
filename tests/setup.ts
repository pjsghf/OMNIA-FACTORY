import { afterEach, vi } from 'vitest';

// jsdom-only globals. The Node suites load this file too, so everything here is
// guarded on a DOM actually being present.
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  await import('@testing-library/jest-dom/vitest');

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // jsdom implements neither of these, and App mounts components that call them.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = vi.fn();
  }
}
