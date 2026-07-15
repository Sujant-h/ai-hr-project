import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { Intro } from '../components/Intro';

const _HF = "https://d8j0ntlcm91z4.cloudfront.net/user_33IJIDZ0cOmwdzXkCP5nbQryjVC/";
const IMG_ORB = _HF + "hf_20260618_184056_8486b8b4-b288-4344-996a-53ea801af5bc.png";
const IMG_DATA = _HF + "hf_20260618_184103_c3dd220e-bda5-4964-8a2d-0e87b9fd77dd.png";
const IMG_WAVE = _HF + "hf_20260618_184108_568fd0ad-6da7-4830-962a-35a70bf8d220.png";
const IMG_STEP_UPLOAD = _HF + "hf_20260619_105340_e82eb3e8-ca18-4a12-a2a4-0a17fa185ae7.png";
const IMG_STEP_ANALYZE = _HF + "hf_20260619_105345_3d63247e-224a-4452-9886-fc6bafea6e9c.png";
const IMG_STEP_DECIDE = _HF + "hf_20260619_105350_b7e7816d-3170-4cfb-9f07-be85ce02fce0.png";
const IMG_HERO = _HF + "hf_20260621_115229_842ad9a6-e33f-449f-9f24-0875dee50874.png";

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { hasSeenIntro } = useSessionStore();

  const handleStartDemo = () => {
    navigate('/workspace');
  };

  return (
    <>
      <Intro />
      <div style={{ opacity: hasSeenIntro ? 1 : 0, transition: 'opacity 0.8s ease' }}>
        
        {/* 1) Hero */}
        <div className="vhero reveal reveal-in">
          <img className="vhero-bg" src={IMG_HERO} alt="" />
          <div className="vhero-scrim"></div>
          <div className="vhero-copy">
            <div className="kicker">Recruiting AI · Multi-Agent HR</div>
            <h1 className="display">Bewerbungen verstehen.<br /><span className="g">Menschen entscheiden.</span></h1>
            <p className="big">
              Sechs spezialisierte KI-Agenten lesen Stellenprofile und Lebensläufe, 
              prüfen Anforderungen und decken Informationslücken auf — die Entscheidung bleibt bei dir.
            </p>
          </div>
        </div>
        
        <div data-testid="stHorizontalBlock" style={{ marginTop: '-19vh', position: 'relative', zIndex: 3, display: 'flex', justifyContent: 'center' }}>
          <span className="cta-lift"></span>
          <div className="stButton">
            <button kind="primary" onClick={handleStartDemo} style={{ padding: '14px 32px', fontSize: '1.1rem' }}>
              🚀 Demo starten
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', height: '420px', background: 'transparent', overflow: 'hidden', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%), linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)', WebkitMaskComposite: 'source-in' }}>
          {/* @ts-ignore */}
          <spline-viewer url="https://prod.spline.design/4PF4J4YenOXJHe4A/scene.splinecode" style={{ position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', transform: 'translate(-50%,-50%) scale(1.1)', transformOrigin: 'center center' }}></spline-viewer>
        </div>

        <div className="problem-wrap">
          <div className="problem-copy story reveal reveal-in" id="problem" style={{ paddingBottom: 0, paddingTop: '54px' }}>
            <div className="kicker">Das Problem</div>
            <h2 className="display">5–10 Stunden<br /><span className="g">pro Stelle.</span></h2>
            <p className="big">
              Ohne eigene HR-Abteilung wird jede Ausschreibung zur Belastung: 
              unterschiedliche CV-Formate, fehlende Angaben, keine nachvollziehbare Bewertung.
            </p>
          </div>
        </div>

        <div className="story reveal reveal-in" style={{ paddingTop: '20px' }}>
          <div className="stats">
            <div className="stat c1">
              <div className="ic">⏱️</div>
              <div className="n">5–10 h</div>
              <div className="l">Sichtungsaufwand pro Stelle</div>
            </div>
            <div className="stat c2">
              <div className="ic">🛡️</div>
              <div className="n">100 %</div>
              <div className="l">der Schritte im Audit Log</div>
            </div>
            <div className="stat c3">
              <div className="ic">⚖️</div>
              <div className="n">0</div>
              <div className="l">automatische Entscheidungen</div>
            </div>
          </div>
        </div>

        {/* 3) Lösung */}
        <div className="story reveal reveal-in" id="loesung">
          <div className="split rev">
            <div className="media-wrap">
              <img src={IMG_ORB} alt="Recruiting AI" />
            </div>
            <div>
              <div className="kicker">Die Lösung</div>
              <h2 className="display">Ein Agenten-<br /><span className="g">team</span>, ein Flow.</h2>
              <p className="big">
                Vom Stellenprofil bis zur Rückfrage: jeder Agent hat genau eine Aufgabe — 
                transparent, überprüfbar, nachvollziehbar.
              </p>
            </div>
          </div>
        </div>

        <div className="story reveal reveal-in" style={{ paddingTop: '24px' }}>
          <div className="steps">
            <div className="stepcard">
              <div className="k">SCHRITT 01</div>
              <h3>Stelle & Bewerbungen</h3>
              <p>Stellenprofil einfügen, Lebensläufe als PDF oder Text hochladen.</p>
            </div>
            <div className="stepcard">
              <div className="k">SCHRITT 02</div>
              <h3>Analyse & Abgleich</h3>
              <p>Der CV-Agent strukturiert die Daten, der Matching-Agent prüft jede Anforderung.</p>
            </div>
            <div className="stepcard">
              <div className="k">SCHRITT 03</div>
              <h3>Lücken & Rückfragen</h3>
              <p>Fehlende Angaben werden sichtbar — höfliche Rückfragen entstehen automatisch.</p>
            </div>
          </div>
        </div>

        {/* 3b) Horizontal scroll gallery */}
        <div className="story reveal reveal-in" id="schritte" style={{ paddingBottom: '8px' }}>
          <div className="kicker">Im Detail</div>
          <h2 className="display">Drei Schritte. <span className="g">Ein Flow.</span></h2>
          <p className="big">Scrolle horizontal durch den Ablauf.</p>
        </div>

        <div className="bleed galfade reveal reveal-in">
          <div className="hscroll">
            <div className="hcard">
              <img src={IMG_STEP_UPLOAD} alt="Hochladen" loading="lazy" />
              <div className="cap"><div className="k">SCHRITT 01</div><h4>Hochladen</h4><p>Stelle & Lebensläufe rein — als PDF oder Text.</p></div>
            </div>
            <div className="hcard">
              <img src={IMG_STEP_ANALYZE} alt="Analysieren" loading="lazy" />
              <div className="cap"><div className="k">SCHRITT 02</div><h4>Analysieren</h4><p>CV-Agent strukturiert, Matching-Agent prüft jede Anforderung.</p></div>
            </div>
            <div className="hcard">
              <img src={IMG_STEP_DECIDE} alt="Entscheiden" loading="lazy" />
              <div className="cap"><div className="k">SCHRITT 03</div><h4>Entscheiden</h4><p>Der Mensch wählt — nie der Algorithmus.</p></div>
            </div>
            <div className="hcard">
              <img src={IMG_ORB} alt="Multi-Agent" loading="lazy" />
              <div className="cap"><div className="k">SYSTEM</div><h4>Multi-Agent</h4><p>Sechs Agenten, ein sauberer, nachvollziehbarer Flow.</p></div>
            </div>
            <div className="hcard">
              <img src={IMG_WAVE} alt="Audit Log" loading="lazy" />
              <div className="cap"><div className="k">TRANSPARENZ</div><h4>Audit Log</h4><p>Jeder Verarbeitungsschritt lückenlos dokumentiert.</p></div>
            </div>
          </div>
        </div>

        {/* 4) Demo CTA */}
        <div className="story reveal reveal-in" style={{ textAlign: 'center' }}>
          <div className="kicker" style={{ textAlign: 'center' }}>Live-Demo</div>
          <h2 className="display">Probier es im Workspace.</h2>
          <p className="big" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
            Lade Demo-Daten oder deine eigenen Bewerbungen — analysieren, Kandidatenprofile öffnen, 
            Rückfragen als E-Mail-Entwurf erstellen.
          </p>
          <div className="stButton" style={{ marginTop: '30px', display: 'flex', justifyContent: 'center' }}>
            <button kind="primary" onClick={handleStartDemo} style={{ padding: '14px 32px', fontSize: '1.1rem' }}>
              Workspace öffnen →
            </button>
          </div>
        </div>

        {/* 5) Ergebnisse */}
        <div className="story reveal reveal-in">
          <div className="split">
            <div>
              <div className="kicker">Ergebnisse</div>
              <h2 className="display">Struktur statt<br /><span className="g">Bauchgefühl.</span></h2>
              <p className="big">
                Saubere Kandidatenprofile, eine transparente Qualifikationscheckliste und ein 
                lückenloses Audit Log — Human-in-the-Loop by Design. Keine Rangfolge, keine Empfehlung.
              </p>
            </div>
            <div className="media-wrap">
              <img src={IMG_DATA} alt="Strukturierte Kandidatendaten" />
            </div>
          </div>
        </div>

        {/* 6) Pricing */}
        <div className="story reveal reveal-in" id="preise" style={{ textAlign: 'center' }}>
          <div className="kicker" style={{ textAlign: 'center' }}>Preise</div>
          <h2 className="display">Einfach. Planbar.</h2>
        </div>
        
        <div className="story reveal reveal-in" style={{ paddingTop: '16px' }}>
          <div className="pricing">
            <div className="price p1">
              <div className="pn">Starter</div>
              <div className="pp">0€<small> / Demo</small></div>
              <ul>
                <li>Vollständiger Workspace</li>
                <li>Bis zu 5 Bewerbungen</li>
                <li>Audit Log</li>
              </ul>
            </div>
            <div className="price feat">
              <div className="badge-pop">Beliebt</div>
              <div className="pn">Team</div>
              <div className="pp">49€<small> / Monat</small></div>
              <ul>
                <li>Unbegrenzte Bewerbungen</li>
                <li>Alle sechs Agenten</li>
                <li>Rückfragen-E-Mails</li>
                <li>Priorisierter Support</li>
              </ul>
            </div>
            <div className="price p3">
              <div className="pn">Enterprise</div>
              <div className="pp">Auf Anfrage</div>
              <ul>
                <li>SSO &amp; Rollen</li>
                <li>Eigene Modelle / API</li>
                <li>Audit-Export</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Final CTA band */}
        <div className="cta-band reveal reveal-in">
          <h2 className="display" style={{ fontSize: 'clamp(2rem,4vw,3rem)' }}>Bereit für den ersten Screening-Lauf?</h2>
          <p className="big" style={{ margin: '14px auto 0' }}>Starte in Sekunden — ganz ohne Setup.</p>
          <div className="stButton" style={{ marginTop: '30px', display: 'flex', justifyContent: 'center' }}>
            <button kind="primary" onClick={handleStartDemo} style={{ padding: '14px 32px', fontSize: '1.1rem' }}>
              🚀 Demo starten
            </button>
          </div>
        </div>
        <div style={{ height: '60px' }}></div>

      </div>
    </>
  );
};
