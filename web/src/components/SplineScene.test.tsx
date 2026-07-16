import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplineScene } from './SplineScene';

// The viewer bundle registers a custom element as a side effect and pulls in
// WebGL; jsdom has neither. The tests assert the poster-first contract and the
// reduced-motion opt-out, not the 3D, so stub the module.
vi.mock('@splinetool/viewer', () => ({}));

// jsdom lacks IntersectionObserver; provide one that never intersects, so the
// only way a scene mounts in these tests is the `eager` path.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function mockMatchMedia(reduce: boolean, isDesktop = true) {
  vi.stubGlobal('matchMedia', (query: string) => {
    let matches = false;
    if (query.includes('prefers-reduced-motion')) matches = reduce;
    else if (query.includes('min-width')) matches = isDesktop;
    return {
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', NoopObserver);
  mockMatchMedia(false);
});
afterEach(() => vi.unstubAllGlobals());

describe('SplineScene', () => {
  it('shows the poster before the scene is approached', () => {
    render(<SplineScene url="x" poster={<div data-testid="poster" />} />);
    expect(screen.getByTestId('poster')).toBeInTheDocument();
    expect(document.querySelector('spline-viewer')).toBeNull();
  });

  it('keeps only the poster under reduced motion, even when eager', () => {
    mockMatchMedia(true);
    render(<SplineScene url="x" eager poster={<div data-testid="poster" />} />);
    expect(screen.getByTestId('poster')).toBeInTheDocument();
    expect(document.querySelector('spline-viewer')).toBeNull();
  });

  it('keeps only the poster on mobile, even when eager', () => {
    mockMatchMedia(false, false);
    render(<SplineScene url="x" eager poster={<div data-testid="poster" />} />);
    expect(screen.getByTestId('poster')).toBeInTheDocument();
    expect(document.querySelector('spline-viewer')).toBeNull();
  });

  it('mounts the viewer on desktop when eager and motion is allowed', async () => {
    render(<SplineScene url="scene-url" eager poster={<div data-testid="poster" />} />);
    await vi.waitFor(() => {
      expect(document.querySelector('spline-viewer')).not.toBeNull();
    });
    expect(document.querySelector('spline-viewer')?.getAttribute('url')).toBe('scene-url');
  });
});
