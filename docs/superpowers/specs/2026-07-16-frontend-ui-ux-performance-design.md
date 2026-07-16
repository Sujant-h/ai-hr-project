# Spec B — Frontend UI/UX/performance pass

**Date:** 2026-07-16
**Status:** Design approved; refine against the code once Spec A lands
**Depends on:** [Spec A — Reconnect the frontend to the API](2026-07-16-frontend-api-reconnect-design.md)

## Context

The app is a **portfolio showpiece**, shared as a **public link opened on any
device**, including phones on mobile data. The 3D and motion work is a feature,
not overhead: the goal is to make it load fast, not to remove it.

Spec A makes the app work. This spec makes it fast, accessible, and polished.
It assumes Spec A has landed: correct types, the Workspace split into per-tab
components, and a working screening flow.

## Non-goals

- **Dark mode.** The shadcn CSS variables for it exist in `index.css`, but
  nothing toggles them and there is no evidence it is wanted.
- **An i18n framework.** The app is German-only and that is fine.
- **Persistence.** See Spec A: reload-clears-everything is a documented privacy
  promise (`README.md:436`).

## Design

### 1. Merge the intro into the hero

Today: a fixed full-screen 3D gate (`Intro.tsx`), dismissed by click, then a PNG
hero, then a second Spline band — three set-pieces before any content. The gate
labels itself "Scroll to Explore" but only responds to click, and `hasSeenIntro`
is never persisted, so it re-gates every visit.

The intro becomes the hero's background rather than a gate:

- The robot Spline (`Ji0hiX2hb-mU5zX1`) renders as the hero background with the
  existing headline over it.
- `IMG_HERO` (the PNG hero) is deleted.
- The `hasSeenIntro` gate, its dismissal logic, and Home's `opacity: 0` /
  `transition` trick all go with it. `Intro.tsx` is deleted.

Result: one strong first impression instead of two competing ones, one scroll to
content instead of three, and one fewer full-viewport asset on the critical path.

### 2. Spline loading strategy

The single largest cost on the page, and all of it decorative.

- **Bundle the viewer.** Add `@splinetool/viewer` as a dependency and import it,
  rather than injecting `https://unpkg.com/@splinetool/viewer@1.9.48/...` at
  runtime. Removes a third-party origin from the critical path and pins the
  version.
- **Load on approach.** An `IntersectionObserver` mounts each scene only as it
  nears the viewport. The hero scene is above the fold and loads immediately;
  the band and the workspace scene do not.
- **Poster behind every scene.** A static image sits under each scene so the box
  is never empty while the runtime boots, and so the fallbacks below have
  something to show.
- **Opt out of 3D entirely** under `prefers-reduced-motion: reduce` or
  `Save-Data`, showing the poster instead. One change that is both an
  accessibility fix and a mobile-data win.
- `preconnect` to `prod.spline.design` in `index.html`.

### 3. Route splitting

`React.lazy` + `Suspense` for Home and Workspace, so the workspace bundle does
not carry Home's framer-motion tree, its gallery, or its Spline scene. Add
`manualChunks` to split the React vendor chunk.

### 4. Images

Six CloudFront PNGs remain after the hero is deleted.

- Pull them into `src/assets` as WebP so Vite hashes and serves them. A
  portfolio piece should not depend on a third party's CDN path — the current
  URLs embed a `user_33IJ...` id that nobody controls.
- Explicit `width`/`height` on every image (currently zero have them, so every
  one contributes CLS).
- `loading="lazy"` + `decoding="async"` below the fold; the hero is eager.
- Decorative images take `alt=""` rather than `alt="Hero Background"`.

### 5. Accessibility

- `<html lang="de">`. It says `en`; every word of content is German. This is the
  cheapest and most consequential a11y fix in the app.
- A real `<title>` (currently `web`), a meta description, and Open Graph tags —
  this link gets shared, so the preview card is part of the portfolio.
- **Tabs → Radix Tabs.** `@radix-ui/react-*` is already a dependency. The
  hand-rolled strip has no `role="tablist"`, no `aria-selected`, and no arrow-key
  navigation; Radix brings roving focus for free.
- **Drawer → Radix Dialog.** `@radix-ui/react-dialog` is already installed and
  entirely unused. `CandidateDetail` currently has no focus trap, no Escape
  handler, no focus restore, and no `role="dialog"`. Radix supplies all four.
- **The file input.** `className="hidden"` is `display: none`, which makes it
  unfocusable — keyboard users cannot upload at all. Use an `sr-only` pattern.
- **The drop zone.** It says "Ziehe Textdateien hierher" and has no `onDrop`
  handler. Implement the drop the copy promises. (Spec A makes `.pdf` valid too,
  so the copy becomes "PDF oder Text".)
- `prefers-reduced-motion` gates framer-motion via `useReducedMotion()`, in
  addition to the Spline opt-out above.
- Contrast audit on text sitting over Spline scenes and gradients, where
  `drop-shadow` is currently doing the work.
- Visible `focus-visible` rings throughout.

### 6. UX

- **Tab state in the URL** (`/workspace?tab=kandidaten`), so deep links work and
  the back button moves between tabs instead of leaving the workspace.
- **Loading states.** `handleParseJob` has none. Every action gets a pending
  state on its button; results get skeletons.
- **Visible disabled reasons.** "Gesamtanalyse starten" silently no-ops when
  there is no job profile. Say why it is disabled.

### 7. Code quality

- Stable keys (candidate `id`) instead of array indices.
- The indigo→blue gradient is copy-pasted across five call sites; fold it into a
  `cva` variant in `ui/button.tsx`.
- Remove the unused `useNavigate` import in `Workspace.tsx`.

## Verification

- Lighthouse mobile, before and after, via the Chrome DevTools MCP. Capture both
  numbers in the PR.
- Bundle size before and after, per chunk.
- Keyboard-only walkthrough: upload → analysis → detail drawer → close, with
  focus restored to the trigger.
- Verify with `prefers-reduced-motion: reduce` that no Spline scene loads and
  every poster shows.
- Confirm no layout shift on a cold load throttled to 4G.
