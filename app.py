"""
Recruiting AI — Multi-Agent HR Demo
===================================

A premium SaaS-style Streamlit application built around a fully deterministic
multi-agent recruiting workflow. The app works without any external API key:
all extraction and matching is done with transparent, rule-based demo logic.

Architecture
------------
The code is split into layers, each in its own module:

1. DATA STRUCTURES  -> models.py            (the contract both backends return)
2. BACKEND          -> agents/rules.py      (deterministic agents, pure functions)
                       llm_agents.py        (OpenAI backend, same contract)
                       agents/dispatch.py   (LLM first, rules as fallback)
3. UI / LAYOUT      -> this module          (render_* functions + Streamlit state)
4. CSS              -> static/styles.css

Only this module imports Streamlit: the agents stay pure and testable.

Human-in-the-loop principle
---------------------------
The agents only EXTRACT and COMPARE information. They never rank candidates,
never produce a hiring recommendation and never make a decision. The final
judgement is always left to a human recruiter.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from functools import lru_cache
from html import escape  # imported as `escape`: render_spline_embed uses `html` as a local
from pathlib import Path
from typing import Optional

import streamlit as st
import streamlit.components.v1 as components

# PDF reading lives entirely in llm_agents.pdf_to_markdown (pymupdf4llm, with a
# pypdf fallback); see llm_agents.pdf_support_available() for the UI hint.
import llm_agents
from agents.dispatch import (
    AgentRun,
    analyze_cv,
    analyze_job_profile,
    backend_label,
    match_candidate,
    summarize_backends,
)
from agents.rules import (
    generate_email,
    informationsluecken_agent,
    rueckfragen_agent,
)
from models import AuditEntry


def audit_fallback(agent: str, run: AgentRun) -> None:
    """Record an LLM->rules fallback, if one happened, in the audit log."""
    if run.fallback_reason:
        audit(agent, "LLM-Fehler — Fallback auf Regeln", run.fallback_reason)



# --- Agent 6: Audit-Log -----------------------------------------------------

def audit(agent: str, action: str, detail: str = "") -> None:
    """Append a tamper-evident processing record to the audit log."""
    st.session_state.audit.append(
        AuditEntry(
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            agent=agent,
            action=action,
            detail=detail,
        )
    )


# --- Parallelism & caching --------------------------------------------------
#
# Each LLM call is an independent HTTP request that can take seconds, and the
# agents are pure, so candidates can be processed concurrently instead of one
# after another. Two rules keep this safe:
#
#   * Only the dispatchers run on worker threads. Streamlit's session state is
#     not thread-safe, so audit(), the cache and every st.* call stay on the
#     main thread — which is exactly why the dispatchers were made pure.
#   * Results are re-ordered back onto the input order, never zipped by
#     completion time.
#
# The cache is keyed on content, not identity: at temperature=0 the same CV and
# the same requirements always yield the same answer, so re-running an analysis
# should cost nothing. Only successful runs are cached — caching a fallback
# would pin a candidate to rule-based results for the rest of the session
# because of one transient API timeout.

MAX_PARALLEL_CALLS = 4  # keep well clear of API rate limits


def _run_parallel(fn, items: list) -> list:
    """Map `fn` over `items`, concurrently when that can actually help.

    Results are returned in the order of `items`. With the rule-based backend
    there is no I/O to overlap, so the work runs inline.
    """
    if len(items) <= 1 or not llm_agents.llm_available():
        return [fn(item) for item in items]
    with ThreadPoolExecutor(max_workers=min(len(items), MAX_PARALLEL_CALLS)) as pool:
        return list(pool.map(fn, items))  # pool.map preserves input order


def requirements_key(requirements: list) -> str:
    """A stable content key for a set of requirements."""
    payload = [(r.id, r.kind, str(r.value), r.importance) for r in requirements]
    return json.dumps(payload, sort_keys=True, ensure_ascii=False)


def cache_key(*parts: str) -> str:
    return hashlib.sha256("\x00".join(parts).encode("utf-8")).hexdigest()


def cache_get(key: str):
    return st.session_state.analysis_cache.get(key)


def cache_put(key: str, run: AgentRun) -> None:
    """Cache a successful run. Fallbacks are deliberately not cached."""
    if run.fallback_reason is None:
        st.session_state.analysis_cache[key] = run


# --- Utilities --------------------------------------------------------------

def extract_text_from_upload(uploaded_file) -> str:
    """Read an uploaded PDF or TXT file as clean Markdown.

    PDFs go through llm_agents.pdf_to_markdown, which already tries pymupdf4llm
    first and falls back to pypdf itself: Markdown preserves the document
    structure for the LLM while costing far fewer tokens than raw layout text."""
    name = uploaded_file.name.lower()
    data = uploaded_file.read()
    if name.endswith(".pdf"):
        return llm_agents.pdf_to_markdown(data)
    try:
        return llm_agents.clean_markdown(data.decode("utf-8", errors="ignore"))
    except Exception:
        return ""


def run_full_analysis() -> None:
    """Run the matching, gap and follow-up agents for every candidate."""
    reqs = st.session_state.requirements
    candidates = st.session_state.candidates
    reqs_key = requirements_key(reqs)
    keys = [cache_key(cand.raw_text, reqs_key) for cand in candidates]

    # Only candidates without a cached result reach the API, and they go in
    # parallel rather than one round-trip after another.
    todo = [cand for cand, key in zip(candidates, keys) if cache_get(key) is None]
    fresh = _run_parallel(lambda cand: match_candidate(cand, reqs), todo)
    for cand, run in zip(todo, fresh):
        audit_fallback("Matching-Agent", run)
        cache_put(cache_key(cand.raw_text, reqs_key), run)
    by_candidate_id = {id(cand): run for cand, run in zip(todo, fresh)}

    backends: list = []
    for cand, key in zip(candidates, keys):
        run = by_candidate_id.get(id(cand)) or cache_get(key)
        cand.matches = run.result
        backends.append(run.backend)
        cand.gaps = informationsluecken_agent(cand, cand.matches)
        cand.questions = rueckfragen_agent(cand, cand.gaps)
    audit(
        "Matching-Agent",
        "Anforderungsabgleich durchgeführt",
        f"{len(candidates)} Kandidat(en) gegen {len(reqs)} "
        f"Anforderung(en) geprüft (Backend: {summarize_backends(backends)}).",
    )
    audit("Informationslücken-Agent", "Lücken analysiert", "Fehlende Angaben pro Kandidat ermittelt.")
    audit("Rückfragen-Agent", "Rückfragen generiert", "Höfliche Rückfragen je Informationslücke erstellt.")
    st.session_state.analysis_done = True


# --- Demo seed data ---------------------------------------------------------

DEMO_JOB = """Senior Backend Entwickler (m/w/d)

Wir suchen eine erfahrene Persönlichkeit für unser Produktteam.

Anforderungen:
- Mindestens 5 Jahre Berufserfahrung in der Softwareentwicklung
- Sehr gute Kenntnisse in Python und SQL
- Erfahrung mit AWS und Docker
- Abgeschlossenes Studium (Bachelor) im Bereich Informatik
- Sehr gute Deutsch- und Englischkenntnisse
- Projektmanagement und Scrum wünschenswert
"""

DEMO_CVS = [
    (
        "Lena Hoffmann",
        """Name: Lena Hoffmann
E-Mail: lena.hoffmann@example.com
Berufserfahrung: 7 Jahre als Softwareentwicklerin
Skills: Python, SQL, AWS, Docker, Scrum
Ausbildung: Master Informatik
Sprachen: Deutsch, Englisch
""",
    ),
    (
        "Tomáš Novák",
        """Name: Tomas Novak
Berufserfahrung: 3 Jahre Backend
Skills: Python, JavaScript
Ausbildung: Bachelor
Sprachen: Englisch
""",
    ),
    (
        "Sarah Klein",
        """Name: Sarah Klein
E-Mail: sarah.klein@example.com
Skills: Java, SQL, Kubernetes
Ausbildung: Bachelor Wirtschaftsinformatik
Sprachen: Deutsch, Englisch, Französisch
""",
    ),
]


def load_demo_data() -> None:
    st.session_state.job_text = DEMO_JOB
    job_run = analyze_job_profile(DEMO_JOB)
    audit_fallback("Stellenprofil-Agent", job_run)
    st.session_state.requirements = job_run.result
    audit(
        "Stellenprofil-Agent",
        "Demo-Stellenprofil analysiert",
        f"{len(st.session_state.requirements)} Anforderungen erkannt (Backend: {job_run.backend}).",
    )
    st.session_state.candidates = []
    backends: list = []
    for i, (name, text) in enumerate(DEMO_CVS):
        run = analyze_cv(name, "Demo-Daten", text, i)
        audit_fallback("CV-Agent", run)
        backends.append(run.backend)
        st.session_state.candidates.append(run.result)
    audit(
        "CV-Agent",
        "Demo-Bewerbungen analysiert",
        f"{len(DEMO_CVS)} Lebensläufe verarbeitet (Backend: {summarize_backends(backends)}).",
    )
    run_full_analysis()


# =============================================================================
#  STATE INITIALISATION
# =============================================================================

def init_state() -> None:
    defaults = {
        "page": "home",
        "job_text": "",
        "requirements": [],
        "candidates": [],
        "audit": [],
        "analysis_done": False,
        "selected_candidate": None,
        "email_drafts": {},
        "intro_done": False,
        # content-hash -> AgentRun, so re-running an analysis costs nothing
        "analysis_cache": {},
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


# =============================================================================
#  UI / LAYOUT / CSS
# =============================================================================

@lru_cache(maxsize=None)
def load_css() -> str:
    """Return the app's stylesheet, wrapped in a <style> tag.

    The CSS lives in static/styles.css rather than in a string literal here: at
    ~390 lines it dominated this module, and a real .css file gets editor
    support. Cached because Streamlit re-runs this script on every interaction.
    """
    css = (Path(__file__).parent / "static" / "styles.css").read_text(encoding="utf-8")
    return f"<style>\n{css}\n</style>"


def _h(value: object) -> str:
    """Escape a value for interpolation into raw HTML.

    Anything rendered with unsafe_allow_html=True that originates from an
    uploaded CV, a filename or an LLM response MUST go through this. Without it
    a CV containing `Name: <img src=x onerror=...>` executes script in the
    recruiter's session — cv_agent lifts the name straight out of the document
    and the LLM backend's notes are model-controlled text.

    Only the data needs escaping; the app's own static markup is trusted.
    """
    return escape(str(value))


def _logo_data_uri() -> Optional[str]:
    """Return a base64 data URI for a logo file if one exists in the repo."""
    for path in ("assets/logo.png", "logo.png", "assets/logo.svg", "logo.svg",
                 "assets/logo.webp", "logo.webp"):
        if os.path.exists(path):
            mime = ("image/svg+xml" if path.endswith(".svg")
                    else "image/webp" if path.endswith(".webp") else "image/png")
            with open(path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            return f"data:{mime};base64,{b64}"
    return None


def _brand_mark(size: int = 32) -> str:
    """Logo image: a repo file (assets/logo.png) takes priority, then the
    generated brand logo URL, otherwise the ✦ fallback glyph."""
    src = _logo_data_uri() or globals().get("LOGO_URL")
    if src:
        return (
            f'<img src="{src}" alt="Recruiting AI" '
            f'style="width:{size}px;height:{size}px;border-radius:9px;object-fit:contain;">'
        )
    return (
        f'<span style="width:{size}px;height:{size}px;border-radius:9px;display:inline-flex;'
        "align-items:center;justify-content:center;background:linear-gradient(135deg,#7c5cff,#22d3ee);"
        'color:#fff;font-size:16px;">✦</span>'
    )


def render_nav() -> None:
    """Clean top navigation: brand on the left, a single primary CTA on the
    right (one main action, no button clutter)."""
    brand, spacer, cta = st.columns([2.4, 3.2, 1.7])
    with brand:
        st.markdown(
            """
            <span class="navbar-mark"></span>
            <div style="display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.15rem;
                        color:#0f1226;transform:translateY(-2px);">
              __MARK__
              Recruiting&nbsp;AI
              <span style="font-size:.72rem;font-weight:600;color:#7c5cff;background:rgba(124,92,255,.10);
                           padding:3px 9px;border-radius:999px;margin-left:6px;">Multi-Agent HR</span>
            </div>
            """.replace("__MARK__", _brand_mark(32)),
            unsafe_allow_html=True,
        )
    with spacer:
        if st.session_state.page == "home":
            st.markdown(
                """
                <div class="navlinks">
                  <a href="#problem">Das Problem</a>
                  <a href="#loesung">Die Lösung</a>
                  <a href="#schritte">Schritte</a>
                  <a href="#preise">Preise</a>
                </div>
                """,
                unsafe_allow_html=True,
            )
    with cta:
        if st.session_state.page == "home":
            if st.button("Workspace öffnen →", type="primary", use_container_width=True, key="nav_cta"):
                st.session_state.page = "workspace"
                st.rerun()
        else:
            if st.button("← Startseite", use_container_width=True, key="nav_home"):
                st.session_state.page = "home"
                st.session_state.selected_candidate = None
                st.rerun()
    # The nav is position:fixed (out of flow). On the home page the full-screen
    # hero tucks up under it, so no spacer is needed; on the other pages we
    # reserve space so content starts below the floating bar.
    spacer_h = 0 if st.session_state.page == "home" else 84
    st.markdown(f"<div style='height:{spacer_h}px;'></div>", unsafe_allow_html=True)


def render_intro() -> None:
    """Immersive fullscreen intro gate.

    On first load this is the ONLY thing rendered — no navbar, no header,
    no page content. Clicking the CTA, scrolling, or pressing a key slides
    the hero smoothly upward and reloads the app with `?started=1`, which
    reveals the actual website (navbar + sections).
    """
    # Page-specific CSS: hide all Streamlit chrome and remove padding so the
    # hero truly fills the viewport with nothing below the fold.
    st.markdown(
        """
        <style>
          header[data-testid="stHeader"]{display:none !important;}
          [data-testid="stToolbar"]{display:none !important;}
          [data-testid="stDecoration"]{display:none !important;}
          .block-container{padding:0 !important; max-width:100% !important;}
          [data-testid="stAppViewContainer"]{overflow:hidden !important;}
          footer{display:none !important;}
          /* Full-bleed, fullscreen hero iframe (only on the intro page) */
          .element-container:has(iframe[title="st.iframe"]),
          .element-container:has(iframe[title="streamlit_components.v1.html.html"]){
            width:100vw !important; margin-left:calc(50% - 50vw) !important;
            margin-right:calc(50% - 50vw) !important; height:100vh !important;
          }
          iframe[title="st.iframe"],
          iframe[title="streamlit_components.v1.html.html"]{
            width:100vw !important; height:100vh !important; border:none !important;
            display:block; background:transparent !important;
          }
        </style>
        """,
        unsafe_allow_html=True,
    )

    intro_html = """
    <style>
      html,body{margin:0;padding:0;height:100%;overflow:hidden;background:transparent;
        font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;}
      .hero{
        position:relative; height:100vh; width:100vw; overflow:hidden; cursor:pointer;
        transition:transform .85s cubic-bezier(.76,0,.24,1), opacity .85s ease;
        background:linear-gradient(180deg,#fbfbff 0%, #f1f2fb 100%);
      }
      .hero.lift{ transform:translateY(-100%); opacity:0; }
      /* Spline graphic fills the entire viewport, scaled up to "cover" the
         screen (object-fit: cover behaviour) so the orb + wave dominate and
         no empty white space remains around the scene. */
      spline-viewer{
        position:absolute; top:50%; left:50%;
        width:100vw; height:100vh; display:block;
        /* the orb sits slightly left in the scene's own composition, so nudge
           the canvas right to visually centre it */
        transform:translate(-43%,-50%) scale(1.7);
        transform-origin:center center;
      }
      @media (max-width:900px){
        spline-viewer{ transform:translate(-43%,-50%) scale(2.4); }
      }
      /* transparent full-screen click target -> advance on click anywhere
         (incl. the scene's own "JOIN US NOW") */
      .catcher{position:absolute; inset:0; z-index:3; background:transparent;}
      .scroll{
        position:absolute; bottom:6vh; left:0; right:0; margin:0 auto; width:max-content;
        color:#6b5bd0; font-size:.76rem; letter-spacing:.2em; text-transform:uppercase;
        display:flex; flex-direction:column; align-items:center; gap:10px; cursor:pointer;
        animation:fadeUp 1.1s ease both .4s; z-index:4; pointer-events:none;
      }
      .arrow{ width:18px;height:18px;border-right:2px solid #6b5bd0;
        border-bottom:2px solid #6b5bd0; transform:rotate(45deg);
        animation:bob 1.8s infinite ease-in-out; }
      @keyframes bob{0%,100%{transform:rotate(45deg) translate(0,0);opacity:.4;}
        50%{transform:rotate(45deg) translate(4px,4px);opacity:1;}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
    </style>
    <script type="module"
      src="https://unpkg.com/@splinetool/viewer@1.9.48/build/spline-viewer.js"></script>
    <div class="hero" id="hero">
      <spline-viewer
        url="https://prod.spline.design/Ji0hiX2hb-mU5zX1/scene.splinecode"
        events-target="global"></spline-viewer>
      <div class="catcher" id="catcher"></div>
      <div class="scroll"><span>Scroll to Explore</span><div class="arrow"></div></div>
    </div>
    <script>
      (function(){
        var fired = false;
        function reveal(){
          if(fired) return; fired = true;
          document.getElementById('hero').classList.add('lift');
          setTimeout(function(){
            try{
              var base = window.parent.location.pathname;
              window.parent.location.href = base + '?started=1';
            }catch(e){
              window.location.href = '?started=1';
            }
          }, 780);
        }
        document.getElementById('catcher').addEventListener('click', reveal);
        window.addEventListener('wheel', function(e){ if(e.deltaY > 4) reveal(); }, {passive:true});
        var sy = null;
        window.addEventListener('touchstart', function(e){ sy = e.touches[0].clientY; }, {passive:true});
        window.addEventListener('touchmove', function(e){
          if(sy !== null && (sy - e.touches[0].clientY) > 28) reveal();
        }, {passive:true});
        window.addEventListener('keydown', function(e){
          if(e.key==='ArrowDown' || e.key===' ' || e.key==='Enter' || e.key==='PageDown') reveal();
        });
      })();
    </script>
    """
    components.html(intro_html, height=900, scrolling=False)


# --- Higgsfield brand visuals (generated, hosted on CDN) --------------------
_HF = "https://d8j0ntlcm91z4.cloudfront.net/user_33IJIDZ0cOmwdzXkCP5nbQryjVC/"
IMG_ORB = _HF + "hf_20260618_184056_8486b8b4-b288-4344-996a-53ea801af5bc.png"
IMG_DATA = _HF + "hf_20260618_184103_c3dd220e-bda5-4964-8a2d-0e87b9fd77dd.png"
IMG_WAVE = _HF + "hf_20260618_184108_568fd0ad-6da7-4830-962a-35a70bf8d220.png"
# Step visuals (isometric, 3:4) for the horizontal scroll gallery
IMG_STEP_UPLOAD = _HF + "hf_20260619_105340_e82eb3e8-ca18-4a12-a2a4-0a17fa185ae7.png"
IMG_STEP_ANALYZE = _HF + "hf_20260619_105345_3d63247e-224a-4452-9886-fc6bafea6e9c.png"
IMG_STEP_DECIDE = _HF + "hf_20260619_105350_b7e7816d-3170-4cfb-9f07-be85ce02fce0.png"

# Spline scene used as the visual in the "Das Problem" section
SPLINE_PROBLEM = "https://prod.spline.design/4PF4J4YenOXJHe4A/scene.splinecode"

# Hero background: silk-wave brand graphic on a full-bleed purple->blue gradient
IMG_HERO = _HF + "hf_20260621_115229_842ad9a6-e33f-449f-9f24-0875dee50874.png"
# Brand logo (Higgsfield-generated RM monogram). Overridden by a repo file
# (assets/logo.png) if present.
LOGO_URL = _HF + "hf_20260621_113356_37574f61-266d-4c83-a8e0-bdd07a191331.png"


def render_spline_embed(url: str, height: int = 560) -> None:
    """Embed a Spline scene as a large, borderless background graphic
    (transparent — no card, no box) that blends into the section."""
    html = (
        """
        <style>
          html,body{margin:0;padding:0;background:transparent;overflow:hidden;}
          .splinebg{position:relative; width:100%; height:__H__px; background:transparent; overflow:hidden;
            /* soft fade on all edges so the ribbon blends cleanly into the page */
            -webkit-mask-image:
              linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%),
              linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%);
            -webkit-mask-composite:source-in;
            mask-image:
              linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%),
              linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%);
            mask-composite:intersect;}
          /* scale the scene up so the ribbon spans edge-to-edge with no side gap */
          spline-viewer{position:absolute; top:50%; left:50%;
            width:100%; height:100%;
            transform:translate(-50%,-50%) scale(1.1); transform-origin:center center;}
        </style>
        <script type="module"
          src="https://unpkg.com/@splinetool/viewer@1.9.48/build/spline-viewer.js"></script>
        <div class="splinebg">
          <spline-viewer url="__URL__" events-target="global"></spline-viewer>
        </div>
        """
    ).replace("__H__", str(height)).replace("__URL__", url)
    components.html(html, height=height + 4, scrolling=False)


def render_scroll_reveal() -> None:
    """Wire an IntersectionObserver onto the parent document's `.reveal`
    elements so sections fade/slide in smoothly as they enter the viewport.

    Runs inside a 0-height component iframe (same-origin), with a safety
    timeout that force-reveals everything so content is never stuck hidden.
    """
    components.html(
        """
        <script>
        (function(){
          function run(){
            try{
              var doc = window.parent.document;
              var els = doc.querySelectorAll('.reveal:not(.reveal-bound)');
              if(!els.length){ setTimeout(run, 150); return; }
              els.forEach(function(el){ el.classList.add('reveal-bound'); });
              if('IntersectionObserver' in window.parent){
                var io = new window.parent.IntersectionObserver(function(entries){
                  entries.forEach(function(e){
                    if(e.isIntersecting){ e.target.classList.add('reveal-in'); io.unobserve(e.target); }
                  });
                }, {threshold:0.10, rootMargin:'0px 0px -7% 0px'});
                els.forEach(function(el){ io.observe(el); });
                setTimeout(function(){ els.forEach(function(el){ el.classList.add('reveal-in'); }); }, 2800);
              } else {
                els.forEach(function(el){ el.classList.add('reveal-in'); });
              }
            }catch(err){}
          }
          setTimeout(run, 60);
        })();

        /* Force muted autoplay of background videos. Streamlit-injected
           <video> tags don't always start on their own (esp. Safari), so we
           set the muted property and call play() from here. */
        (function(){
          function play(){
            try{
              var vids = window.parent.document.querySelectorAll('video');
              vids.forEach(function(v){
                v.muted = true; v.defaultMuted = true; v.playsInline = true;
                v.setAttribute('muted',''); v.setAttribute('playsinline','');
                var pr = v.play(); if(pr && pr.catch){ pr.catch(function(){}); }
                if(!v.dataset.boundplay){
                  v.dataset.boundplay = '1';
                  ['canplay','loadeddata'].forEach(function(ev){
                    v.addEventListener(ev, function(){ var p=v.play(); if(p&&p.catch) p.catch(function(){}); });
                  });
                }
              });
            }catch(e){}
          }
          [120, 700, 1800].forEach(function(t){ setTimeout(play, t); });
        })();
        </script>
        """,
        height=0,
    )


def _main_cta(label: str, key: str, lift: bool = False) -> None:
    """The single, centered primary call-to-action -> opens the workspace.

    ``lift`` pulls the button up so the hero's CTA sits inside the hero
    instead of floating in empty space below it."""
    c1, c2, c3 = st.columns([1, 1.2, 1])
    with c2:
        if lift:
            st.markdown("<span class='cta-lift'></span>", unsafe_allow_html=True)
        if st.button(label, type="primary", use_container_width=True, key=key):
            st.session_state.page = "workspace"
            st.rerun()


def _step(num: str, title: str, body: str) -> str:
    return (
        f'<div class="stepcard"><div class="k">SCHRITT {num}</div>'
        f"<h3>{title}</h3><p>{body}</p></div>"
    )


def render_home() -> None:
    """Premium scroll-storytelling landing page (revealed after the intro):
    Problem -> Lösung -> Demo -> Ergebnisse -> Pricing, with one main CTA."""

    # 1) Hero with a bright pastel brand graphic + one clear message + main CTA
    st.markdown(
        '<div class="vhero reveal">'
        f'<img class="vhero-bg" src="{IMG_HERO}" alt="">'
        '<div class="vhero-scrim"></div>'
        '<div class="vhero-copy">'
        '<div class="kicker">Recruiting AI · Multi-Agent HR</div>'
        '<h1 class="display">Bewerbungen verstehen.<br><span class="g">Menschen entscheiden.</span></h1>'
        '<p class="big">Sechs spezialisierte KI-Agenten lesen Stellenprofile und Lebensläufe, '
        "prüfen Anforderungen und decken Informationslücken auf — die Entscheidung bleibt bei dir.</p>"
        "</div></div>",
        unsafe_allow_html=True,
    )
    _main_cta("🚀  Demo starten", "cta_top", lift=True)

    # 2) Problem — text first, the full-bleed Spline ribbon sits below it
    st.markdown(
        '<div class="story reveal" id="problem" style="padding-bottom:0;">'
        '<div class="kicker">Das Problem</div>'
        '<h2 class="display">5–10 Stunden<br><span class="g">pro Stelle.</span></h2>'
        '<p class="big">Ohne eigene HR-Abteilung wird jede Ausschreibung zur Belastung: '
        "unterschiedliche CV-Formate, fehlende Angaben, keine nachvollziehbare Bewertung.</p>"
        "</div>",
        unsafe_allow_html=True,
    )
    render_spline_embed(SPLINE_PROBLEM, height=420)
    st.markdown(
        '<div class="story reveal" style="padding-top:0;"><div class="stats">'
        '<div class="stat c1"><div class="ic">⏱️</div><div class="n">5–10 h</div>'
        '<div class="l">Sichtungsaufwand pro Stelle</div></div>'
        '<div class="stat c2"><div class="ic">🛡️</div><div class="n">100 %</div>'
        '<div class="l">der Schritte im Audit Log</div></div>'
        '<div class="stat c3"><div class="ic">⚖️</div><div class="n">0</div>'
        '<div class="l">automatische Entscheidungen</div></div>'
        "</div></div>",
        unsafe_allow_html=True,
    )

    # 3) Lösung — visual main idea (the orb) + clean steps
    st.markdown(
        '<div class="story reveal" id="loesung"><div class="split rev">'
        f'<div class="media-wrap"><img src="{IMG_ORB}" alt="Recruiting AI"></div>'
        "<div>"
        '<div class="kicker">Die Lösung</div>'
        '<h2 class="display">Ein Agenten-<br><span class="g">team</span>, ein Flow.</h2>'
        '<p class="big">Vom Stellenprofil bis zur Rückfrage: jeder Agent hat genau eine Aufgabe — '
        "transparent, überprüfbar, nachvollziehbar.</p>"
        "</div></div></div>",
        unsafe_allow_html=True,
    )
    st.markdown(
        '<div class="story reveal" style="padding-top:24px;"><div class="steps">'
        + _step("01", "Stelle & Bewerbungen", "Stellenprofil einfügen, Lebensläufe als PDF oder Text hochladen.")
        + _step("02", "Analyse & Abgleich", "Der CV-Agent strukturiert die Daten, der Matching-Agent prüft jede Anforderung.")
        + _step("03", "Lücken & Rückfragen", "Fehlende Angaben werden sichtbar — höfliche Rückfragen entstehen automatisch.")
        + "</div></div>",
        unsafe_allow_html=True,
    )

    # 3b) Horizontal scroll gallery (Raycast-style) with Higgsfield visuals
    st.markdown(
        '<div class="story reveal" id="schritte" style="padding-bottom:8px;">'
        '<div class="kicker">Im Detail</div>'
        '<h2 class="display">Drei Schritte. <span class="g">Ein Flow.</span></h2>'
        '<p class="big">Scrolle horizontal durch den Ablauf.</p></div>',
        unsafe_allow_html=True,
    )

    def _hcard(img: str, k: str, title: str, body: str) -> str:
        return (
            f'<div class="hcard"><img src="{img}" alt="{title}" loading="lazy">'
            f'<div class="cap"><div class="k">{k}</div><h4>{title}</h4><p>{body}</p></div></div>'
        )

    st.markdown(
        '<div class="bleed galfade reveal"><div class="hscroll">'
        + _hcard(IMG_STEP_UPLOAD, "SCHRITT 01", "Hochladen", "Stelle & Lebensläufe rein — als PDF oder Text.")
        + _hcard(IMG_STEP_ANALYZE, "SCHRITT 02", "Analysieren", "CV-Agent strukturiert, Matching-Agent prüft jede Anforderung.")
        + _hcard(IMG_STEP_DECIDE, "SCHRITT 03", "Entscheiden", "Der Mensch wählt — nie der Algorithmus.")
        + _hcard(IMG_ORB, "SYSTEM", "Multi-Agent", "Sechs Agenten, ein sauberer, nachvollziehbarer Flow.")
        + _hcard(IMG_WAVE, "TRANSPARENZ", "Audit Log", "Jeder Verarbeitungsschritt lückenlos dokumentiert.")
        + "</div></div>",
        unsafe_allow_html=True,
    )

    # 4) Demo — invite into the workspace (single CTA)
    st.markdown(
        '<div class="story reveal" style="text-align:center;">'
        '<div class="kicker" style="text-align:center;">Live-Demo</div>'
        '<h2 class="display">Probier es im Workspace.</h2>'
        '<p class="big" style="margin-left:auto;margin-right:auto;">Lade Demo-Daten oder deine eigenen '
        "Bewerbungen — analysieren, Kandidatenprofile öffnen, Rückfragen als E-Mail-Entwurf erstellen.</p>"
        "</div>",
        unsafe_allow_html=True,
    )
    _main_cta("Workspace öffnen  →", "cta_demo")

    # 5) Ergebnisse — outcomes + wave visual
    st.markdown(
        '<div class="story reveal"><div class="split">'
        "<div>"
        '<div class="kicker">Ergebnisse</div>'
        '<h2 class="display">Struktur statt<br><span class="g">Bauchgefühl.</span></h2>'
        '<p class="big">Saubere Kandidatenprofile, eine transparente Qualifikationscheckliste und ein '
        "lückenloses Audit Log — Human-in-the-Loop by Design. Keine Rangfolge, keine Empfehlung.</p>"
        "</div>"
        f'<div class="media-wrap"><img src="{IMG_DATA}" alt="Strukturierte Kandidatendaten"></div>'
        "</div></div>",
        unsafe_allow_html=True,
    )

    # 6) Pricing — simple, one highlighted plan
    st.markdown(
        '<div class="story reveal" id="preise" style="text-align:center;">'
        '<div class="kicker" style="text-align:center;">Preise</div>'
        '<h2 class="display">Einfach. Planbar.</h2></div>',
        unsafe_allow_html=True,
    )
    st.markdown(
        '<div class="story reveal" style="padding-top:16px;"><div class="pricing">'
        '<div class="price p1"><div class="pn">Starter</div>'
        '<div class="pp">0€<small> / Demo</small></div>'
        "<ul><li>Vollständiger Workspace</li><li>Bis zu 5 Bewerbungen</li><li>Audit Log</li></ul></div>"
        '<div class="price feat"><div class="badge-pop">Beliebt</div><div class="pn">Team</div>'
        '<div class="pp">49€<small> / Monat</small></div>'
        "<ul><li>Unbegrenzte Bewerbungen</li><li>Alle sechs Agenten</li><li>Rückfragen-E-Mails</li>"
        "<li>Priorisierter Support</li></ul></div>"
        '<div class="price p3"><div class="pn">Enterprise</div>'
        '<div class="pp">Auf Anfrage</div>'
        "<ul><li>SSO &amp; Rollen</li><li>Eigene Modelle / API</li><li>Audit-Export</li></ul></div>"
        "</div></div>",
        unsafe_allow_html=True,
    )

    # Final CTA band (one button)
    st.markdown(
        '<div class="cta-band reveal">'
        '<h2 class="display" style="font-size:clamp(2rem,4vw,3rem);">Bereit für den ersten Screening-Lauf?</h2>'
        '<p class="big" style="margin:14px auto 0;">Starte in Sekunden — ganz ohne Setup.</p>'
        "</div>",
        unsafe_allow_html=True,
    )
    _main_cta("🚀  Demo starten", "cta_final")
    st.markdown("<div style='height:60px;'></div>", unsafe_allow_html=True)


# --- Workspace helpers ------------------------------------------------------

STATUS_META = {
    "erfuellt": ("✓ erfüllt", "pill-ok"),
    "teilweise": ("◐ teilweise", "pill-part"),
    "offen": ("? offen", "pill-open"),
    "nicht_erfuellt": ("✗ nicht erfüllt", "pill-no"),
}


def render_workspace() -> None:
    # Spline graphic as a header background, with the title overlaid on top.
    render_spline_embed(SPLINE_PROBLEM, height=300)
    st.markdown(
        '<div class="ws-head"><div class="ws-copy section" style="margin:0;">'
        '<span class="eyebrow">Recruiting Workspace</span>'
        "<h2>Dein Screening-Arbeitsbereich</h2>"
        '<p class="lead">Stellenprofil definieren, Bewerbungen analysieren und Ergebnisse '
        "transparent prüfen — die Entscheidung bleibt bei dir.</p></div></div>",
        unsafe_allow_html=True,
    )

    # Quick action: load demo data
    a1, a2 = st.columns([1, 3])
    with a1:
        if st.button("✨ Demo-Daten laden", type="primary", use_container_width=True):
            with st.spinner(f"Agenten analysieren die Demo-Daten … (Backend: {backend_label()})"):
                load_demo_data()
            st.success("Demo-Stellenprofil und 3 Bewerbungen geladen & analysiert.")

    tabs = st.tabs(
        [
            "① Stellenprofil",
            "② Bewerbungen",
            "③ Kandidaten",
            "④ Informationslücken",
            "⑤ Rückfragen",
            "⑥ Audit Log",
        ]
    )

    # --- Tab 1: Stellenprofil ---
    with tabs[0]:
        st.subheader("Stellenprofil-Agent")
        st.caption("Füge die Stellenbeschreibung ein. Der Agent extrahiert messbare Anforderungen.")
        st.session_state.job_text = st.text_area(
            "Stellenbeschreibung",
            value=st.session_state.job_text,
            height=260,
            placeholder="z. B. Senior Backend Entwickler – 5 Jahre Erfahrung, Python, SQL, AWS …",
        )
        if st.button("🎯 Stellenprofil analysieren", type="primary"):
            if st.session_state.job_text.strip():
                with st.spinner(f"Stellenprofil-Agent extrahiert Anforderungen … (Backend: {backend_label()})"):
                    job_run = analyze_job_profile(st.session_state.job_text)
                audit_fallback("Stellenprofil-Agent", job_run)
                st.session_state.requirements = job_run.result
                audit(
                    "Stellenprofil-Agent",
                    "Stellenprofil analysiert",
                    f"{len(st.session_state.requirements)} Anforderung(en) erkannt (Backend: {job_run.backend}).",
                )
                st.session_state.analysis_done = False
                st.success(f"{len(st.session_state.requirements)} Anforderung(en) erkannt.")
            else:
                st.warning("Bitte zuerst eine Stellenbeschreibung einfügen.")

        if st.session_state.requirements:
            st.markdown("##### Erkannte Anforderungen")
            for req in st.session_state.requirements:
                imp = "Muss" if req.importance == "muss" else "Kann"
                imp_color = "#dc2626" if req.importance == "muss" else "#b4790c"
                st.markdown(
                    f'<div class="cand" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">'
                    f'<span><b>{_h(req.label)}</b> <span style="color:#5b6178;font-size:.85rem;">· {_h(req.kind)}</span></span>'
                    f'<span class="pill" style="background:{imp_color}1a;color:{imp_color};">{imp}</span></div>',
                    unsafe_allow_html=True,
                )

    # --- Tab 2: Bewerbungen ---
    with tabs[1]:
        st.subheader("CV-Agent")
        st.caption("Lade Lebensläufe als PDF oder TXT hoch — oder füge Text manuell ein.")
        if not llm_agents.pdf_support_available():
            st.info("Hinweis: Es ist keine PDF-Bibliothek installiert (`pymupdf4llm` oder `pypdf`) — "
                    "PDF-Text kann nicht gelesen werden. TXT-Upload und manuelle Eingabe funktionieren.")

        uploaded = st.file_uploader(
            "Bewerbungen hochladen",
            type=["pdf", "txt"],
            accept_multiple_files=True,
        )
        manual = st.text_area(
            "…oder einen Lebenslauf als Text einfügen",
            height=140,
            placeholder="Name: …\nBerufserfahrung: …\nSkills: …",
        )

        if st.button("📑 Bewerbungen analysieren", type="primary"):
            idx = len(st.session_state.candidates)
            with st.spinner(f"CV-Agent strukturiert die Lebensläufe … (Backend: {backend_label()})"):
                # Read every upload here, on the main thread: Streamlit's
                # UploadedFile is not safe to touch from a worker. PDF ->
                # Markdown happens BEFORE the LLM sees anything (token
                # optimization + structure preservation).
                docs = [
                    (f.name.rsplit(".", 1)[0], f.name, extract_text_from_upload(f))
                    for f in (uploaded or [])
                ]
                if manual.strip():
                    docs.append((f"Kandidat {idx + len(docs) + 1}", "Manuelle Eingabe", manual))

                def _analyze(item):
                    offset, (name, source, text) = item
                    return analyze_cv(name, source, text, idx + offset)

                runs = _run_parallel(_analyze, list(enumerate(docs)))

            new_candidates = []
            backends: list = []
            for run in runs:
                audit_fallback("CV-Agent", run)
                backends.append(run.backend)
                new_candidates.append(run.result)

            if new_candidates:
                st.session_state.candidates.extend(new_candidates)
                audit(
                    "CV-Agent",
                    "Bewerbungen analysiert",
                    f"{len(new_candidates)} Lebenslauf/Lebensläufe verarbeitet "
                    f"(Backend: {summarize_backends(backends)}).",
                )
                st.session_state.analysis_done = False
                st.success(f"{len(new_candidates)} Bewerbung(en) analysiert. Gesamt: {len(st.session_state.candidates)}.")
            else:
                st.warning("Bitte mindestens eine Datei hochladen oder Text einfügen.")

        if st.session_state.candidates:
            st.markdown(f"##### {len(st.session_state.candidates)} Bewerbung(en) im Workspace")
            for c in st.session_state.candidates:
                st.markdown(
                    f'<div class="cand" style="margin-bottom:10px;">'
                    f'<span class="nm">{_h(c.name)}</span> '
                    f'<span class="meta">· {_h(c.source)}</span><br>'
                    f'<span class="meta">{len(c.skills)} Skills · '
                    f'{c.years if c.years is not None else "?"} Jahre · {_h(c.education_label)}</span></div>',
                    unsafe_allow_html=True,
                )
            if st.button("🗑️ Bewerbungen zurücksetzen"):
                st.session_state.candidates = []
                st.session_state.analysis_done = False
                audit("Workspace", "Bewerbungen zurückgesetzt", "Alle Kandidatendaten entfernt.")
                st.rerun()

    # --- Tab 3: Kandidaten (overview + detail) ---
    with tabs[2]:
        st.subheader("Kandidatenübersicht")
        if not st.session_state.requirements:
            st.info("Bitte zuerst ein Stellenprofil analysieren (Tab ①).")
        elif not st.session_state.candidates:
            st.info("Bitte zuerst Bewerbungen hochladen (Tab ②).")
        else:
            if st.button("▶️ Anforderungsabgleich starten", type="primary"):
                with st.spinner(f"Matching-Agent vergleicht semantisch … (Backend: {backend_label()})"):
                    run_full_analysis()
                st.success("Matching, Informationslücken und Rückfragen wurden erstellt.")

            st.markdown(
                '<div class="hitl" style="margin:8px 0 18px;padding:14px 20px;">'
                "⚖️ <b>Keine automatische Rangfolge.</b> Die Reihenfolge entspricht dem Upload. "
                "Es gibt keine Bewertung und keine Empfehlung — die Entscheidung triffst du."
                "</div>",
                unsafe_allow_html=True,
            )

            if st.session_state.analysis_done:
                cols = st.columns(2)
                for i, cand in enumerate(st.session_state.candidates):
                    met = sum(1 for m in cand.matches if m.status == "erfuellt")
                    total = len(cand.matches)
                    skills_html = "".join(f'<span class="tag">{_h(s)}</span>' for s in cand.skills[:6]) or '<span class="meta">keine erkannt</span>'
                    with cols[i % 2]:
                        st.markdown(
                            f'<div class="cand" style="margin-bottom:14px;">'
                            f'<span class="nm">{_h(cand.name)}</span>'
                            f'<div class="meta">{met}/{total} Anforderungen erfüllt · '
                            f'{len(cand.gaps)} Informationslücke(n)</div>'
                            f'<div style="margin-top:10px;">{skills_html}</div></div>',
                            unsafe_allow_html=True,
                        )
                        if st.button(f"Profil ansehen — {cand.name}", key=f"sel_{cand.id}", use_container_width=True):
                            st.session_state.selected_candidate = cand.id
                            st.session_state.page = "candidate"
                            st.rerun()
            else:
                st.caption("Noch kein Abgleich durchgeführt — klicke auf „Anforderungsabgleich starten“.")

    # --- Tab 4: Informationslücken ---
    with tabs[3]:
        st.subheader("Informationslücken-Agent")
        if not st.session_state.analysis_done:
            st.info("Bitte zuerst den Anforderungsabgleich starten (Tab ③).")
        else:
            any_gap = False
            for cand in st.session_state.candidates:
                if cand.gaps:
                    any_gap = True
                    st.markdown(f"**{cand.name}** — {len(cand.gaps)} Lücke(n)")
                    for g in cand.gaps:
                        st.markdown(f"- **{g.requirement_label}** — {g.description}")
                    st.markdown("")
            if not any_gap:
                st.success("Keine Informationslücken erkannt.")

    # --- Tab 5: Rückfragen ---
    with tabs[4]:
        st.subheader("Rückfragen-Agent")
        st.caption("Wähle pro Bewerber:in die gewünschten Rückfragen aus und generiere daraus "
                   "einen E-Mail-Entwurf. Die E-Mail wird **nicht** automatisch versendet.")
        if not st.session_state.analysis_done:
            st.info("Bitte zuerst den Anforderungsabgleich starten (Tab ③).")
        else:
            any_q = False
            for cand in st.session_state.candidates:
                if not cand.questions:
                    continue
                any_q = True
                with st.expander(f"💬  {cand.name}  ·  {len(cand.questions)} mögliche Rückfrage(n)", expanded=False):
                    st.markdown("**Rückfragen auswählen:**")
                    selected = []
                    for idx, q in enumerate(cand.questions):
                        if st.checkbox(q, key=f"q_{cand.id}_{idx}"):
                            selected.append(q)

                    if st.button("✉️ Rückfragen-E-Mail generieren", key=f"genmail_{cand.id}", type="primary"):
                        if selected:
                            to, subject, body = generate_email(cand, selected)
                            ver = st.session_state.email_drafts.get(cand.id, {}).get("ver", 0) + 1
                            st.session_state.email_drafts[cand.id] = {
                                "to": to, "subject": subject, "body": body, "ver": ver,
                            }
                            audit(
                                "Rückfragen-Agent",
                                "E-Mail-Entwurf erstellt",
                                f"{len(selected)} Rückfrage(n) für {cand.name} zusammengestellt (nicht versendet).",
                            )
                        else:
                            st.warning("Bitte mindestens eine Rückfrage auswählen.")

                    # --- E-Mail-Fenster (Entwurf, wird NICHT gesendet) ---
                    draft = st.session_state.email_drafts.get(cand.id)
                    if draft:
                        ver = draft["ver"]
                        st.markdown(
                            '<div class="cand" style="margin-top:14px;border:1px solid rgba(124,92,255,.25);">'
                            '<div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#0f1226;">'
                            '✉️ E-Mail-Entwurf <span class="pill pill-part">Entwurf · nicht gesendet</span></div>'
                            '</div>',
                            unsafe_allow_html=True,
                        )
                        to = st.text_input("An", value=draft["to"], key=f"emailto_{cand.id}_{ver}")
                        subject = st.text_input("Betreff", value=draft["subject"], key=f"emailsub_{cand.id}_{ver}")
                        body = st.text_area("Nachricht", value=draft["body"], height=320, key=f"emailbody_{cand.id}_{ver}")

                        mailto = (
                            "mailto:" + urllib.parse.quote(to)
                            + "?subject=" + urllib.parse.quote(subject)
                            + "&body=" + urllib.parse.quote(body)
                        )
                        st.markdown(
                            f'<a href="{_h(mailto)}" target="_blank" style="display:inline-block;'
                            "text-decoration:none;background:linear-gradient(135deg,#7c5cff,#3b82f6);"
                            "color:#fff;font-weight:600;padding:.6rem 1.2rem;border-radius:14px;"
                            'box-shadow:0 12px 30px rgba(124,92,255,.40);">📧 In E-Mail-Programm öffnen</a>'
                            '<span class="meta" style="margin-left:12px;">Öffnet deinen Mail-Client mit '
                            "vorausgefülltem Entwurf — Versand bestätigst du selbst.</span>",
                            unsafe_allow_html=True,
                        )
                        if st.button("🗑️ Entwurf verwerfen", key=f"deldraft_{cand.id}"):
                            st.session_state.email_drafts.pop(cand.id, None)
                            st.rerun()

            if not any_q:
                st.success("Keine Rückfragen nötig — alle Angaben vollständig.")

    # --- Tab 6: Audit Log ---
    with tabs[5]:
        st.subheader("Audit Log")
        st.caption("Jeder Verarbeitungsschritt wird lückenlos dokumentiert.")
        if not st.session_state.audit:
            st.info("Noch keine Aktivität protokolliert.")
        else:
            for entry in reversed(st.session_state.audit):
                st.markdown(
                    f'<div class="cand" style="margin-bottom:8px;">'
                    f'<span class="meta">{_h(entry.timestamp)}</span> · '
                    f'<b style="color:#7c5cff;">{_h(entry.agent)}</b> — {_h(entry.action)}'
                    f'<br><span class="meta">{_h(entry.detail)}</span></div>',
                    unsafe_allow_html=True,
                )
            if st.button("🗑️ Audit Log leeren"):
                st.session_state.audit = []
                st.rerun()


def render_candidate_detail() -> None:
    """Dedicated full-page candidate profile (opened via 'Profil ansehen')."""
    cand = next(
        (c for c in st.session_state.candidates if c.id == st.session_state.selected_candidate),
        None,
    )

    if st.button("← Zurück zur Kandidatenübersicht"):
        st.session_state.page = "workspace"
        st.rerun()

    if not cand:
        st.warning("Kandidat:in nicht gefunden.")
        return

    met = sum(1 for m in cand.matches if m.status == "erfuellt")
    total = len(cand.matches)
    st.markdown(
        f'<div class="section" style="margin-top:14px;">'
        f'<span class="eyebrow">Kandidatenprofil</span>'
        f"<h2>👤 {_h(cand.name)}</h2>"
        f'<p class="lead">Quelle: {_h(cand.source)} · Kontakt: {_h(cand.email or "nicht gefunden")} · '
        f'{met}/{total} Anforderungen erfüllt · {len(cand.gaps)} Informationslücke(n)</p></div>',
        unsafe_allow_html=True,
    )

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Skills erkannt", len(cand.skills))
    m2.metric("Berufserfahrung", f"{cand.years} J." if cand.years is not None else "?")
    m3.metric("Abschluss", cand.education_label)
    m4.metric("Sprachen", len(cand.languages))

    if cand.skills:
        skills_html = "".join(f'<span class="tag">{_h(s)}</span>' for s in cand.skills)
        st.markdown(f'<div style="margin:10px 0 4px;">{skills_html}</div>', unsafe_allow_html=True)

    st.markdown("#### Qualifikationscheckliste")
    if cand.matches:
        for m in cand.matches:
            label_txt, pill = STATUS_META.get(m.status, ("?", "pill-open"))
            imp = "Muss" if m.importance == "muss" else "Kann"
            st.markdown(
                f'<div class="cand" style="margin-bottom:8px;display:flex;'
                f'justify-content:space-between;align-items:center;">'
                f'<span><b>{_h(m.label)}</b> <span class="meta">· {imp} · {_h(m.note)}</span></span>'
                f'<span class="pill {pill}">{label_txt}</span></div>',
                unsafe_allow_html=True,
            )
    else:
        st.caption("Noch kein Abgleich für diese:n Kandidat:in durchgeführt.")

    if cand.gaps:
        st.markdown("#### 🧩 Informationslücken")
        for g in cand.gaps:
            st.markdown(f"- **{g.requirement_label}** — {g.description}")
    if cand.questions:
        st.markdown("#### 💬 Vorgeschlagene Rückfragen")
        for q in cand.questions:
            st.markdown(f"- {q}")
        st.caption("Rückfragen auswählen und als E-Mail-Entwurf generieren kannst du im Tab ⑤ Rückfragen.")

    st.markdown(
        '<div class="hitl" style="margin-top:18px;padding:14px 20px;">'
        "⚖️ <b>Human-in-the-Loop:</b> Diese Ansicht zeigt nur extrahierte Daten — "
        "keine Bewertung, keine Empfehlung. Die Entscheidung triffst du."
        "</div>",
        unsafe_allow_html=True,
    )


# =============================================================================
#  MAIN
# =============================================================================

def main() -> None:
    st.set_page_config(
        page_title="Recruiting AI — Multi-Agent HR",
        page_icon="✦",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    st.markdown(load_css(), unsafe_allow_html=True)
    init_state()

    # --- Intro gate -------------------------------------------------------
    # On first load show ONLY the immersive fullscreen hero. The intro is
    # dismissed via the CTA / scroll (which sets ?started=1) or once the user
    # has already entered the app in this session.
    started = ("started" in st.query_params) or st.session_state.intro_done
    if not started:
        render_intro()
        return
    st.session_state.intro_done = True

    # --- Actual website (revealed after the intro) ------------------------
    render_nav()
    if st.session_state.page == "candidate":
        render_candidate_detail()
    elif st.session_state.page == "workspace":
        render_workspace()
    else:
        render_home()

    # Scroll-reveal observer runs on every page so .reveal elements never
    # stay hidden (and animate in as they enter the viewport).
    render_scroll_reveal()


if __name__ == "__main__":
    main()


