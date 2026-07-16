# Frontend UI/UX/Performance Implementation Plan (Spec B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the working app fast, accessible, and polished for a public link opened on any device, without removing the 3D/motion that is the point of a portfolio piece.

**Architecture:** The heavy, decorative Spline scenes move off the critical path: bundled instead of injected from unpkg, loaded on approach via IntersectionObserver, skipped entirely under reduced-motion/Save-Data. The intro gate merges into the hero. CloudFront PNGs become hashed local WebP. Routes split. The hand-rolled tab strip and drawer become Radix Tabs/Dialog for real keyboard a11y.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind 3, framer-motion 12, Radix (Tabs added, Dialog already present), `@splinetool/viewer` (added), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-16-frontend-ui-ux-performance-design.md`

## Global Constraints

- **Never modify `api/`, `agents/`, `models.py`, `llm_agents.py`, or `requirements.txt`.** This is a frontend plan; Spec A already fixed the backend deps.
- **No persistence.** No `localStorage`/`sessionStorage`/zustand `persist` (`README.md:436`).
- All user-facing copy is **German**. `<html lang="de">`.
- Run JS commands from `web/` **inside WSL**, never over the UNC path — `cmd.exe`/`vite-node` break on UNC, and Windows-side `tsc` writes a root-owned `node_modules/.tmp` that then blocks WSL. Use `wsl.exe -d Ubuntu -- bash -lc 'cd ~/projects/ai-hr-project/.claude/worktrees/frontend-reconnect-and-polish/web && <cmd>'`.
- Every Spline scene must degrade to a non-empty poster under `prefers-reduced-motion: reduce` or `Save-Data`. Never leave an empty box.
- Do not regress Spec A: 55 tests pass and `npm run build` is green at the start. Keep both true after every task.

## What Spec A already delivered (do NOT redo)

- File input is `sr-only` (keyboard-reachable); the drop zone has a real `onDrop`.
- Candidate lists key on `candidate.id`, not array index.
- Pending states exist on JobProfileTab (parse), UploadTab (upload/demo/analyze), QuestionsTab (draft).
- "Gesamtanalyse starten" already shows a visible disabled reason.
- The old monolithic `Workspace.tsx` and its `useNavigate` import are gone; the workspace no longer renders a Spline scene at all — only Home does.
- `hide-scrollbar` is defined.

So from Spec B section 5 only lang/meta, Radix Tabs, Radix Dialog, reduced-motion, contrast, and focus-visible remain; from section 6 only tab-state-in-URL; from section 7 only the gradient `cva` variant.

---

### Task 1: HTML head — lang, title, meta, Open Graph, preconnect

**Files:**
- Modify: `web/index.html`

**Interfaces:**
- Consumes: nothing
- Produces: nothing importable; a correct document head

- [ ] **Step 1: Rewrite the head**

Replace the whole of `web/index.html`:

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>Recruiting AI — Multi-Agent HR Screening</title>
    <meta
      name="description"
      content="Sechs spezialisierte KI-Agenten lesen Stellenprofile und Lebensläufe, prüfen Anforderungen und decken Informationslücken auf — die Entscheidung bleibt beim Menschen."
    />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="Recruiting AI — Multi-Agent HR Screening" />
    <meta
      property="og:description"
      content="Bewerbungen verstehen. Menschen entscheiden. Ein transparenter, nachvollziehbarer Screening-Flow — Human-in-the-Loop by Design."
    />
    <meta name="twitter:card" content="summary_large_image" />

    <!-- The Spline scenes are served from here; warm the connection early. -->
    <link rel="preconnect" href="https://prod.spline.design" crossorigin />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Verify the build still passes**

Run: `npm run build`
Expected: PASS. Confirm `dist/index.html` contains `lang="de"` and the new `<title>`.

- [ ] **Step 3: Commit**

```bash
git add web/index.html
git commit -m "feat(web): correct document head for a11y and link sharing

lang was en on all-German content. Adds a real title, meta description, OG
tags for the shared preview card, and a preconnect to the Spline origin."
```

---

### Task 2: A lazy, reduced-motion-aware Spline component

Replaces the runtime unpkg `<script>` injection. One component owns loading the
viewer, the IntersectionObserver, and the poster fallback.

**Files:**
- Create: `web/src/hooks/usePrefersReducedMotion.ts`
- Create: `web/src/hooks/usePrefersReducedMotion.test.ts`
- Create: `web/src/components/SplineScene.tsx`
- Create: `web/src/components/SplineScene.test.tsx`
- Add dependency: `@splinetool/viewer`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `usePrefersReducedMotion(): boolean` — true under `prefers-reduced-motion: reduce` OR `navigator.connection.saveData`
  - `SplineScene` — props `{ url: string; poster?: React.ReactNode; className?: string; eager?: boolean }`. Renders the poster until the scene is both (a) approached (IntersectionObserver) or `eager`, and (b) not reduced-motion. Registers the viewer via dynamic `import('@splinetool/viewer')`.

The custom element `<spline-viewer>` needs a JSX type. Add to `SplineScene.tsx`:

```tsx
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'spline-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        url?: string;
      };
    }
  }
}
```

- [ ] **Step 1: Add the dependency**

```bash
npm i --no-audit --no-fund @splinetool/viewer@^1.9.48
```

(Install runs in WSL per Global Constraints. This is the same package the app
already fetched from unpkg at runtime — now versioned and bundle-managed.)

- [ ] **Step 2: Write the reduced-motion hook test**

Create `web/src/hooks/usePrefersReducedMotion.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

function mockMatchMedia(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduce : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  vi.stubGlobal('navigator', { ...navigator });
});
afterEach(() => vi.unstubAllGlobals());

describe('usePrefersReducedMotion', () => {
  it('is true when the media query matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('is false when nothing opts out', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('is true when the connection asks to save data, a mobile win', () => {
    mockMatchMedia(false);
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } });
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:run -- src/hooks/usePrefersReducedMotion.test.ts`
Expected: FAIL — cannot resolve `./usePrefersReducedMotion`.

- [ ] **Step 4: Implement the hook**

Create `web/src/hooks/usePrefersReducedMotion.ts`:

```ts
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function saveDataOn(): boolean {
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

/**
 * True when the user asked to reduce motion OR the connection asked to save
 * data. Both mean: do not boot a WebGL scene. One check, an a11y win and a
 * mobile-data win at once.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(QUERY).matches || saveDataOn();
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const update = () => setReduced(mql.matches || saveDataOn());
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return reduced;
}
```

- [ ] **Step 5: Run the hook test to verify it passes**

Run: `npm run test:run -- src/hooks/usePrefersReducedMotion.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the SplineScene test**

Create `web/src/components/SplineScene.test.tsx`. jsdom has no
IntersectionObserver and no WebGL, so the test asserts the poster-first contract
and the reduced-motion opt-out, not the actual 3D:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplineScene } from './SplineScene';

// jsdom lacks IntersectionObserver; provide one that never intersects, so the
// only way a scene mounts in these tests is the `eager` path.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function mockMatchMedia(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduce : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
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

  it('mounts the viewer when eager and motion is allowed', async () => {
    render(<SplineScene url="scene-url" eager poster={<div data-testid="poster" />} />);
    // The dynamic import resolves on a microtask; wait for the element.
    await vi.waitFor(() => {
      expect(document.querySelector('spline-viewer')).not.toBeNull();
    });
    expect(document.querySelector('spline-viewer')?.getAttribute('url')).toBe('scene-url');
  });
});
```

- [ ] **Step 7: Run the SplineScene test to verify it fails**

Run: `npm run test:run -- src/components/SplineScene.test.tsx`
Expected: FAIL — cannot resolve `./SplineScene`.

- [ ] **Step 8: Implement SplineScene**

Create `web/src/components/SplineScene.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'spline-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { url?: string };
    }
  }
}

let viewerLoaded: Promise<unknown> | null = null;
function loadViewer(): Promise<unknown> {
  // Load the custom-element bundle once, and only when a scene actually needs
  // it — this is the code that used to come from unpkg at runtime.
  viewerLoaded ??= import('@splinetool/viewer');
  return viewerLoaded;
}

interface Props {
  url: string;
  poster?: ReactNode;
  className?: string;
  /** Above-the-fold scenes load immediately; everything else waits. */
  eager?: boolean;
}

export function SplineScene({ url, poster, className, eager = false }: Props) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [approached, setApproached] = useState(eager);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (approached || reduced) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setApproached(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [approached, reduced]);

  useEffect(() => {
    if (reduced || !approached) return;
    let alive = true;
    void loadViewer().then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [reduced, approached]);

  const showScene = ready && !reduced;

  return (
    <div ref={ref} className={className}>
      {poster}
      {showScene && (
        <spline-viewer
          url={url}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '100%',
            height: '100%',
            transform: 'translate(-50%,-50%) scale(1.1)',
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 9: Run the SplineScene test to verify it passes**

Run: `npm run test:run -- src/components/SplineScene.test.tsx`
Expected: PASS, 3 tests. If the `eager` test times out because the bundled
package does not resolve under jsdom, mock it at the top of the test file:
`vi.mock('@splinetool/viewer', () => ({}))` — the element registration is a side
effect the test does not need; it asserts the element is rendered, not upgraded.

- [ ] **Step 10: Commit**

```bash
git add web/src/hooks/usePrefersReducedMotion.ts web/src/hooks/usePrefersReducedMotion.test.ts web/src/components/SplineScene.tsx web/src/components/SplineScene.test.tsx web/package.json web/package-lock.json
git commit -m "feat(web): lazy, reduced-motion-aware Spline component

Bundles @splinetool/viewer and loads it via dynamic import only when a scene is
approached (IntersectionObserver), never under prefers-reduced-motion or
Save-Data. Replaces the runtime unpkg script injection."
```

---

### Task 3: Merge the intro into the hero

**Files:**
- Modify: `web/src/pages/Home.tsx`
- Delete: `web/src/components/Intro.tsx`
- Modify: `web/src/store/session.ts` (remove `hasSeenIntro`/`setHasSeenIntro`)

**Interfaces:**
- Consumes: `SplineScene` (Task 2)
- Produces: a Home whose first screen is the robot Spline behind the headline

- [ ] **Step 1: Remove the intro gate from the store**

In `web/src/store/session.ts`, delete the `hasSeenIntro` field, the
`setHasSeenIntro` action, its entry in `initial`, and its implementation. Spec A
added these only to keep the old Intro compiling; the gate is now gone.

- [ ] **Step 2: Delete Intro**

```bash
rm web/src/components/Intro.tsx
```

- [ ] **Step 3: Rewrite the Home hero and Spline band**

In `web/src/pages/Home.tsx`:

- Remove `import { Intro } from '../components/Intro';` and
  `import { useSessionStore } from '../store/session';` and the
  `const { hasSeenIntro } = useSessionStore();` line.
- Add `import { SplineScene } from '../components/SplineScene';`.
- Delete the `IMG_HERO` constant.
- Remove `<Intro />` and the `style={{ opacity: hasSeenIntro ? 1 : 0, ... }}`
  from the outer content `div` (it becomes just `className="..."`).

Replace the hero block (the `{/* 1) Hero */}` div through the end of the
`{/* Spline */}` band div) with:

```tsx
        {/* 1) Hero — robot Spline behind the headline */}
        <div className="relative w-full h-[100vh] min-h-[640px] -mt-4">
          <SplineScene
            url="https://prod.spline.design/Ji0hiX2hb-mU5zX1/scene.splinecode"
            eager
            className="absolute inset-0 z-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent_92%)]"
            poster={
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(1100px 700px at 72% 38%, rgba(124,92,255,.22), transparent 60%), radial-gradient(900px 600px at 60% 20%, rgba(59,130,246,.18), transparent 58%), linear-gradient(180deg,#fbfbff 0%, #f1f2fb 100%)',
                }}
              />
            }
          />
          {/* Left-side legibility wash over the scene. */}
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-50 via-slate-50/70 to-transparent"></div>

          <div className="absolute top-1/2 left-[5%] md:left-[10%] xl:left-[calc(50vw-530px)] -translate-y-1/2 max-w-xl z-20 px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">
                Recruiting AI · Multi-Agent HR
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.05] mb-6">
                Bewerbungen verstehen.<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500">
                  Menschen entscheiden.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-lg mb-8">
                Sechs spezialisierte KI-Agenten lesen Stellenprofile und Lebensläufe,
                prüfen Anforderungen und decken Informationslücken auf — die Entscheidung bleibt bei dir.
              </p>
              <Button size="lg" onClick={handleStartDemo} className="rounded-full px-8 py-6 text-lg font-bold shadow-xl shadow-indigo-200 bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105 transition-transform border-0 text-white">
                🚀 Demo starten
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Secondary Spline band — lazy, below the fold */}
        <div className="relative w-full h-[420px] -mt-[15vh] z-30 pointer-events-none">
          <SplineScene
            url="https://prod.spline.design/4PF4J4YenOXJHe4A/scene.splinecode"
            className="absolute inset-0 [mask-image:linear-gradient(180deg,transparent_0%,#000_22%,#000_78%,transparent_100%)]"
            poster={<div aria-hidden="true" className="absolute inset-0" />}
          />
        </div>
```

- [ ] **Step 4: Verify build and tests**

Run: `npm run build && npm run test:run`
Expected: both PASS. The store test still passes (it never asserted
`hasSeenIntro`). If TypeScript flags an unused `motion` import, keep it — it is
still used by the hero and the `FadeIn` helper.

- [ ] **Step 5: Commit**

```bash
git add -A web/src
git commit -m "feat(web): merge the intro gate into the hero

The full-screen click-to-dismiss gate becomes the hero background: the robot
Spline sits behind the headline, lazy and reduced-motion-aware. Drops the PNG
hero, the hasSeenIntro gate and Home's opacity trick. One first impression and
one scroll to content instead of three set-pieces."
```

---

### Task 4: Localize and optimize the images

**Files:**
- Create: `web/src/assets/*.webp` (7 images: 5 gallery/section + 1 nav logo; the hero PNG is already gone)
- Create: `web/scripts/fetch-images.py` (one-off, committed for provenance)
- Modify: `web/src/pages/Home.tsx` (imports + width/height/lazy/alt)
- Modify: `web/src/components/NavBar.tsx` (logo import + dimensions)

**Interfaces:**
- Consumes: nothing
- Produces: hashed local WebP assets, no runtime CloudFront dependency

- [ ] **Step 1: Write the fetch+convert script**

Create `web/scripts/fetch-images.py`:

```python
"""One-off: pull the CloudFront PNGs into src/assets as WebP.

A portfolio piece should not depend on a third party's CDN path. Run once with
the repo's venv Pillow; the WebP outputs are committed, so this need not run
again unless a source image changes.
"""
from __future__ import annotations
import io
import urllib.request
from pathlib import Path
from PIL import Image

BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_33IJIDZ0cOmwdzXkCP5nbQryjVC/"
IMAGES = {
    "orb": "hf_20260618_184056_8486b8b4-b288-4344-996a-53ea801af5bc.png",
    "data": "hf_20260618_184103_c3dd220e-bda5-4964-8a2d-0e87b9fd77dd.png",
    "wave": "hf_20260618_184108_568fd0ad-6da7-4830-962a-35a70bf8d220.png",
    "step-upload": "hf_20260619_105340_e82eb3e8-ca18-4a12-a2a4-0a17fa185ae7.png",
    "step-analyze": "hf_20260619_105345_3d63247e-224a-4452-9886-fc6bafea6e9c.png",
    "step-decide": "hf_20260619_105350_b7e7816d-3170-4cfb-9f07-be85ce02fce0.png",
    "logo": "hf_20260621_113356_37574f61-266d-4c83-a8e0-bdd07a191331.png",
}
OUT = Path(__file__).parent.parent / "src" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

for name, fn in IMAGES.items():
    raw = urllib.request.urlopen(BASE + fn, timeout=30).read()
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    dst = OUT / f"{name}.webp"
    img.save(dst, "WEBP", quality=82, method=6)
    print(f"{dst.name}: {img.width}x{img.height}, {dst.stat().st_size // 1024} KB")
```

- [ ] **Step 2: Run it and record the dimensions**

Run (WSL, repo venv): `../../../../.venv/bin/python scripts/fetch-images.py`
from `web/`, or the absolute venv path. Expected: seven lines printing
`name.webp: WxH, NN KB`. **Record each width×height** — the JSX needs them.

- [ ] **Step 3: Import assets and add dimensions in Home**

In `web/src/pages/Home.tsx`, replace the `_HF`/`IMG_*` URL constants with
imports (Vite hashes and serves these):

```tsx
import IMG_ORB from '../assets/orb.webp';
import IMG_DATA from '../assets/data.webp';
import IMG_WAVE from '../assets/wave.webp';
import IMG_STEP_UPLOAD from '../assets/step-upload.webp';
import IMG_STEP_ANALYZE from '../assets/step-analyze.webp';
import IMG_STEP_DECIDE from '../assets/step-decide.webp';
```

On every `<img>` add `width`/`height` (from Step 2's output — use the real
numbers), `loading="lazy"`, and `decoding="async"`. All Home images are below
the fold now that the hero is Spline, so all are lazy. Example for the solution
image:

```tsx
<img src={IMG_ORB} alt="Illustration des Agenten-Teams" width={1024} height={1024} loading="lazy" decoding="async" className="w-full h-auto rounded-2xl" />
```

Gallery images that are purely decorative take `alt=""`. The two content
images (orb "Lösung", data "Ergebnisse") keep descriptive German alt text.

- [ ] **Step 4: Localize the nav logo**

In `web/src/components/NavBar.tsx`, replace the `_HF`/`LOGO_URL` constants with
`import LOGO_URL from '@/assets/logo.webp';` and add `width={32} height={32}` to
the logo `<img>` (it renders at `w-8 h-8`).

- [ ] **Step 5: Verify build and grep for leftover CloudFront refs**

Run: `npm run build`
Then: `grep -rn "cloudfront\|d8j0ntlcm91z4" src/` — Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add -A web/src web/scripts
git commit -m "perf(web): localize CloudFront PNGs as hashed WebP

Seven images move into src/assets as WebP via a committed one-off script, so the
portfolio no longer depends on a third party's CDN path. Every img gets explicit
width/height (was zero, all CLS), loading=lazy and decoding=async; decorative
images get empty alt."
```

---

### Task 5: Route splitting

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/vite.config.ts`

**Interfaces:**
- Consumes: nothing
- Produces: separate Home and Workspace chunks

- [ ] **Step 1: Lazy-load the routes**

Rewrite `web/src/App.tsx`:

```tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NavBar } from './components/NavBar';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Workspace = lazy(() =>
  import('./pages/workspace/Workspace').then((m) => ({ default: m.Workspace })),
);

function App() {
  return (
    <div>
      <BrowserRouter>
        <NavBar />
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/workspace" element={<Workspace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </div>
  );
}

export default App;
```

`Home` is a named export; the `.then` shim adapts it to `lazy`'s default-export
contract.

- [ ] **Step 2: Split the vendor chunk**

In `web/vite.config.ts`, add a `build.rollupOptions.output.manualChunks` inside
the config object:

```ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
```

- [ ] **Step 3: Verify the split happened**

Run: `npm run build`
Expected: PASS, and the output lists **separate** chunks — a `react-*.js`
vendor chunk and distinct Home and Workspace chunks, rather than one
`index-*.js`. Record the per-chunk sizes for the PR.

- [ ] **Step 4: Commit**

```bash
git add web/src/App.tsx web/vite.config.ts
git commit -m "perf(web): code-split routes and the React vendor chunk

Home and Workspace load lazily, so the workspace no longer ships Home's
framer-motion tree, gallery and Spline scene, and vice versa."
```

---

### Task 6: Radix Tabs + tab state in the URL

**Files:**
- Add dependency: `@radix-ui/react-tabs`
- Modify: `web/src/pages/workspace/Workspace.tsx`
- Create: `web/src/pages/workspace/Workspace.test.tsx`

**Interfaces:**
- Consumes: the existing tab components
- Produces: an accessible tablist whose active tab lives in `?tab=`

The tab identity moves from a number to a slug so the URL is readable. Slugs:
`stellenprofil`, `bewerbungen`, `kandidaten`, `luecken`, `rueckfragen`, `audit`.

- [ ] **Step 1: Add the dependency**

```bash
npm i --no-audit --no-fund @radix-ui/react-tabs@^1.1.0
```

Spec B assumed this was already installed; it was not (only avatar, dialog and
slot are). Dialog, needed in Task 7, is present.

- [ ] **Step 2: Write the test**

Create `web/src/pages/workspace/Workspace.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Workspace } from './Workspace';
import { apiClient } from '../../api/client';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(apiClient, 'getBackend').mockResolvedValue({ label: 'regelbasiert' });
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Workspace />
    </MemoryRouter>,
  );
}

describe('Workspace tabs', () => {
  it('exposes a real tablist', () => {
    renderAt('/workspace');
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
  });

  it('opens the tab named in the URL', () => {
    renderAt('/workspace?tab=audit');
    expect(screen.getByRole('tab', { name: /Audit Log/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('falls back to the first tab when the query is missing or unknown', () => {
    renderAt('/workspace?tab=nonsense');
    expect(screen.getByRole('tab', { name: /Stellenprofil/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('writes the active tab to the URL when the user switches', async () => {
    renderAt('/workspace');
    await userEvent.click(screen.getByRole('tab', { name: /Bewerbungen/ }));
    expect(screen.getByRole('tab', { name: /Bewerbungen/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:run -- src/pages/workspace/Workspace.test.tsx`
Expected: FAIL — no `tablist` role (the current strip is plain buttons).

- [ ] **Step 4: Rewrite the shell with Radix Tabs**

In `web/src/pages/workspace/Workspace.tsx`:

- Replace `import { AnimatePresence, motion } from 'framer-motion';` usage for
  the tab panels with Radix. Add `import * as Tabs from '@radix-ui/react-tabs';`
  and `import { useSearchParams } from 'react-router-dom';`.
- Replace the `TABS` array with slug-bearing entries:

```tsx
const TABS = [
  { slug: 'stellenprofil', label: '① Stellenprofil', Panel: JobProfileTab },
  { slug: 'bewerbungen', label: '② Bewerbungen', Panel: UploadTab },
  { slug: 'kandidaten', label: '③ Kandidaten', Panel: CandidatesTab },
  { slug: 'luecken', label: '④ Informationslücken', Panel: GapsTab },
  { slug: 'rueckfragen', label: '⑤ Rückfragen', Panel: QuestionsTab },
  { slug: 'audit', label: '⑥ Audit Log', Panel: AuditLog },
];
const DEFAULT_SLUG = TABS[0].slug;
```

- Replace the `useState(1)` + button strip + `AnimatePresence` block with:

```tsx
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const active = TABS.some((t) => t.slug === requested) ? requested! : DEFAULT_SLUG;

  const onValueChange = (slug: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', slug);
      return next;
    });
  };
```

```tsx
          <Tabs.Root value={active} onValueChange={onValueChange}>
            <Tabs.List
              aria-label="Screening-Schritte"
              className="hide-scrollbar mb-8 flex overflow-x-auto border-b border-slate-200"
            >
              {TABS.map((tab) => (
                <Tabs.Trigger
                  key={tab.slug}
                  value={tab.slug}
                  className={cn(
                    '-mb-[1px] whitespace-nowrap border-b-2 px-6 py-4 text-[15px] font-semibold transition-all',
                    'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-t-md',
                    'data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700',
                  )}
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <div className="min-h-[600px]">
              {TABS.map((tab) => (
                <Tabs.Content
                  key={tab.slug}
                  value={tab.slug}
                  className="focus-visible:outline-none animate-in fade-in duration-200"
                >
                  <tab.Panel />
                </Tabs.Content>
              ))}
            </div>
          </Tabs.Root>
```

Remove the now-unused `AnimatePresence`/`motion` and `useState` imports.
Radix only mounts the active panel's content, preserving the current behavior.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- src/pages/workspace/Workspace.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify the whole suite and build**

Run: `npm run test:run && npm run build`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/workspace/Workspace.tsx web/src/pages/workspace/Workspace.test.tsx web/package.json web/package-lock.json
git commit -m "feat(web): Radix Tabs with tab state in the URL

The hand-rolled strip had no tablist role, no aria-selected, no arrow-key
nav. Radix supplies all three. The active tab now lives in ?tab=<slug>, so
deep links work and the back button moves between tabs."
```

---

### Task 7: Radix Dialog for the candidate drawer

**Files:**
- Modify: `web/src/components/CandidateDetail.tsx`
- Create: `web/src/components/CandidateDetail.test.tsx`

**Interfaces:**
- Consumes: `@radix-ui/react-dialog` (already installed), store `analyses`/`selectedCandidateId`
- Produces: the same drawer with a focus trap, Escape, focus restore, `role="dialog"`

- [ ] **Step 1: Write the test**

Create `web/src/components/CandidateDetail.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CandidateDetail } from './CandidateDetail';
import { useSessionStore } from '../store/session';
import type { components } from '../api/types';

type CandidateOut = components['schemas']['CandidateOut'];

function candidate(over: Partial<CandidateOut> = {}): CandidateOut {
  return {
    id: 'cand_0', name: 'Lena', source: 'cv.txt', raw_text: 'x', skills: [],
    years: null, education: 0, education_label: 'unbekannt', languages: [],
    email: null, matches: [], gaps: [], questions: [], ...over,
  };
}

beforeEach(() => {
  useSessionStore.getState().reset();
  useSessionStore.getState().setAnalyses([
    { candidate: candidate({ name: 'Lena Hoffmann' }), backend: 'regelbasiert', fallback_reason: null },
  ]);
});

describe('CandidateDetail', () => {
  it('renders nothing until a candidate is selected', () => {
    render(<CandidateDetail />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a dialog for the selected candidate', () => {
    useSessionStore.getState().setSelectedCandidateId('cand_0');
    render(<CandidateDetail />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Lena Hoffmann')).toBeInTheDocument();
  });

  it('closes on Escape and clears the selection', async () => {
    useSessionStore.getState().setSelectedCandidateId('cand_0');
    render(<CandidateDetail />);
    await userEvent.keyboard('{Escape}');
    expect(useSessionStore.getState().selectedCandidateId).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/components/CandidateDetail.test.tsx`
Expected: FAIL — the current custom drawer has no `role="dialog"`.

- [ ] **Step 3: Rewrite CandidateDetail on Radix Dialog**

Rewrite `web/src/components/CandidateDetail.tsx`, keeping all the existing body
content but swapping the outer overlay/motion shell for Radix Dialog. The
`open` state is derived from the store; `onOpenChange(false)` clears the
selection (this is what Escape, overlay click, and the close button all call):

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { cn } from '@/lib/utils';
import { useSessionStore } from '../store/session';
import { STATUS_CLASS, STATUS_LABEL, metCount } from '../lib/status';

export function CandidateDetail() {
  const analyses = useSessionStore((s) => s.analyses);
  const selectedCandidateId = useSessionStore((s) => s.selectedCandidateId);
  const setSelectedCandidateId = useSessionStore((s) => s.setSelectedCandidateId);

  const analysis = analyses.find((a) => a.candidate.id === selectedCandidateId);
  const open = Boolean(analysis);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && setSelectedCandidateId(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-[9999] h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-8 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
        >
          {analysis && (
            <>
              <div className="mb-8 flex items-center justify-between">
                <Dialog.Close asChild>
                  <Button
                    variant="outline"
                    className="rounded-xl border-slate-200 bg-white font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                  >
                    &larr; Zurück
                  </Button>
                </Dialog.Close>
              </div>

              <Dialog.Title className="sr-only">
                Kandidatenprofil: {analysis.candidate.name}
              </Dialog.Title>

              <div className="mb-8">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-600">
                  Kandidatenprofil
                </div>
                <h2 className="mb-2 text-4xl font-black text-slate-900">{analysis.candidate.name}</h2>
                <p className="text-lg font-medium text-slate-600">
                  {metCount(analysis.candidate.matches)}/{analysis.candidate.matches.length}{' '}
                  Anforderungen erfüllt &middot; {analysis.candidate.gaps.length} Informationslücke(n)
                </p>
              </div>

              {/* --- unchanged body: skill/language cards, skill badges,
                  Qualifikationscheckliste, Human-in-the-Loop note.
                  Copy verbatim from the current component's <> body. --- */}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Copy the skill/language stat cards, the skill-badge list, the
Qualifikationscheckliste, and the Human-in-the-Loop note from the existing
component verbatim into the marked spot — only the outer shell changes.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/components/CandidateDetail.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Verify suite and build**

Run: `npm run test:run && npm run build`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/CandidateDetail.tsx web/src/components/CandidateDetail.test.tsx
git commit -m "feat(web): candidate drawer on Radix Dialog

The custom overlay had no focus trap, no Escape, no focus restore, no dialog
role. Radix supplies all four; focus returns to the trigger card on close."
```

---

### Task 8: Motion gating, gradient variant, focus-visible

**Files:**
- Modify: `web/src/components/ui/button.tsx`
- Modify: `web/src/pages/Home.tsx`
- Modify: `web/src/index.css`

**Interfaces:**
- Consumes: `usePrefersReducedMotion` (Task 2)
- Produces: a `gradient` button variant; motion that respects the user's setting

- [ ] **Step 1: Add a gradient button variant**

In `web/src/components/ui/button.tsx`, add to the `variant` map:

```tsx
        gradient:
          "border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-200 hover:from-indigo-500 hover:to-blue-500",
```

This is the gradient copy-pasted across the hero CTA, both Home CTAs, and the
workspace action buttons. (Swapping every call site to `variant="gradient"` is
optional polish; the shared definition is the deliverable. Do not change the
tab or drawer buttons.)

- [ ] **Step 2: Gate Home's scroll animations on reduced motion**

In `web/src/pages/Home.tsx`, make `FadeIn` a no-op when motion is reduced, so
the whole page does not animate on scroll for those users:

```tsx
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
};
```

Also gate the hero headline `motion.div` (Task 3) — give it a reduced branch
that renders a plain `<div>`. Keep it simple: read the hook in `Home` and pass
static styles when reduced.

- [ ] **Step 3: Confirm focus-visible on interactive elements**

The Button base already has `focus-visible:ring-2`. Verify the tab triggers
(Task 6) and the icon buttons in `UploadTab` (the remove-candidate `X`) and
`ErrorBanner` (dismiss) carry a visible `focus-visible:ring`. Add
`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`
to any that lack it. These are small edits to existing elements.

- [ ] **Step 4: Verify suite and build**

Run: `npm run test:run && npm run build`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src
git commit -m "feat(web): reduced-motion gating, gradient button variant, focus rings

FadeIn and the hero headline no longer animate under prefers-reduced-motion.
Folds the five-times-duplicated indigo gradient into a button variant, and adds
focus-visible rings to the icon buttons that lacked them."
```

---

### Task 9: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full suite, build, lint, bundle sizes**

Run (WSL): `npm run test:run && npm run build && npm run lint`
Expected: all tests pass, build succeeds, lint 0 errors.
Record the per-chunk sizes from the build output for the PR, and compare the
total against Spec A's baseline (`index-*.js` was ~436 KB / 138 KB gzip).

- [ ] **Step 2: Run the app and drive it in a browser**

Start backend (WSL, repo root): `.venv/bin/uvicorn api.main:app --port 8000`
Start frontend (WSL, `web/`): `npm run dev`
Then, via the Chrome DevTools MCP against `http://localhost:5173`:

- **Lighthouse mobile** on `/` before/after is the headline metric — capture
  Performance and Accessibility scores. Record both in the PR.
- Confirm the hero shows the robot Spline (or its poster) with the headline
  legible over it, and that content is one scroll away.
- Confirm the secondary Spline band and gallery images load on scroll, not up
  front (Network panel: `scene.splinecode` / `@splinetool` requests fire only
  as you approach).
- Emulate `prefers-reduced-motion: reduce`: reload and confirm **no**
  `spline.design` scene request fires and the hero shows its gradient poster.
- Keyboard-only: Tab to the workspace tabs, move with arrow keys, open a
  candidate (Enter), confirm focus is trapped in the drawer, Escape closes it,
  and focus returns to the card.
- Confirm `?tab=kandidaten` deep-links to that tab and the browser back button
  steps between tabs.

- [ ] **Step 3: Record results and stop the servers**

Write the Lighthouse before/after and bundle numbers into the PR description.
Stop `uvicorn` and `npm run dev`.

---

## Self-Review

**Spec coverage:**

| Spec B section | Task |
|---|---|
| 1. Merge intro into hero | 3 |
| 2. Bundle viewer, lazy load, poster, reduced-motion/Save-Data, preconnect | 1 (preconnect), 2 |
| 3. Route splitting + manualChunks | 5 |
| 4. Images → local WebP, dimensions, lazy, alt | 4 |
| 5. lang/title/meta/OG | 1 |
| 5. Radix Tabs | 6 |
| 5. Radix Dialog | 7 |
| 5. reduced-motion gates framer-motion | 8 |
| 5. focus-visible | 8 |
| 5. file input / drop zone | **Spec A (done)** |
| 6. tab state in URL | 6 |
| 6. loading states / disabled reasons | **Spec A (done)** |
| 7. stable keys | **Spec A (done)** |
| 7. gradient cva variant | 8 |
| 7. unused useNavigate | **Spec A (done — file deleted)** |
| Verification (Lighthouse, keyboard, reduced-motion, bundle) | 9 |

**Contrast audit (spec 5):** folded into Task 9's browser pass — the hero wash
(`from-slate-50 via-slate-50/70`) in Task 3 is the concrete fix for text over
the Spline; Lighthouse a11y flags any remaining contrast failures.

**Placeholder scan:** Task 4 dimensions and Task 7's drawer body are the only
"fill from output/existing" steps; both name exactly what to copy and from
where. No TODO/TBD.

**Type consistency:** `SplineScene` props (`url`, `poster`, `className`,
`eager`) are consumed identically in Task 3. `usePrefersReducedMotion` (Task 2)
is consumed in Task 8. Tab slugs are internal to Task 6. `CandidateDetail`
consumes the same store selectors it did in Spec A.

**Risk flagged:** bundling `@splinetool/viewer` and registering it via dynamic
`import()` (Task 2) is the one unproven integration. If the bundled package does
not register the custom element under Vite, the fallback is to keep a single
injected `<script>` (once, app-level, with the Task 1 preconnect) behind the
same IntersectionObserver + reduced-motion gate — the component's public
contract does not change. Decide during Task 2, Step 9.
