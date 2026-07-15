import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { Intro } from '../components/Intro';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const _HF = "https://d8j0ntlcm91z4.cloudfront.net/user_33IJIDZ0cOmwdzXkCP5nbQryjVC/";
const IMG_ORB = _HF + "hf_20260618_184056_8486b8b4-b288-4344-996a-53ea801af5bc.png";
const IMG_DATA = _HF + "hf_20260618_184103_c3dd220e-bda5-4964-8a2d-0e87b9fd77dd.png";
const IMG_WAVE = _HF + "hf_20260618_184108_568fd0ad-6da7-4830-962a-35a70bf8d220.png";
const IMG_STEP_UPLOAD = _HF + "hf_20260619_105340_e82eb3e8-ca18-4a12-a2a4-0a17fa185ae7.png";
const IMG_STEP_ANALYZE = _HF + "hf_20260619_105345_3d63247e-224a-4452-9886-fc6bafea6e9c.png";
const IMG_STEP_DECIDE = _HF + "hf_20260619_105350_b7e7816d-3170-4cfb-9f07-be85ce02fce0.png";
const IMG_HERO = _HF + "hf_20260621_115229_842ad9a6-e33f-449f-9f24-0875dee50874.png";

const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
  >
    {children}
  </motion.div>
);

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { hasSeenIntro } = useSessionStore();

  const handleStartDemo = () => {
    navigate('/workspace');
  };

  return (
    <>
      <Intro />
      <div 
        className="w-full relative bg-slate-50 overflow-x-hidden pb-20"
        style={{ opacity: hasSeenIntro ? 1 : 0, transition: 'opacity 0.8s ease' }}
      >
        {/* Background gradient */}
        <div className="fixed inset-0 pointer-events-none" style={{
          background: 'radial-gradient(1300px 780px at 80% 4%, rgba(124,92,255,.15), transparent 58%), radial-gradient(1150px 700px at 104% -2%, rgba(59,130,246,.12), transparent 56%), radial-gradient(1000px 700px at -6% 2%, rgba(124,92,255,.08), transparent 60%)'
        }}></div>

        {/* 1) Hero */}
        <div className="relative w-full h-[100vh] min-h-[640px] -mt-4">
          <div className="absolute inset-0 z-0">
            <img src={IMG_HERO} alt="Hero Background" className="w-full h-full object-cover opacity-90 [mask-image:linear-gradient(to_bottom,black_40%,transparent_90%)]" />
          </div>
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-50/80 to-transparent"></div>
          
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
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-lg mb-8">
                Sechs spezialisierte KI-Agenten lesen Stellenprofile und Lebensläufe, 
                prüfen Anforderungen und decken Informationslücken auf — die Entscheidung bleibt bei dir.
              </p>
              <Button size="lg" onClick={handleStartDemo} className="rounded-full px-8 py-6 text-lg font-bold shadow-xl shadow-indigo-200 bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105 transition-transform border-0 text-white">
                🚀 Demo starten
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Spline */}
        <div className="relative w-full h-[420px] -mt-[15vh] z-30 pointer-events-none" style={{
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)'
        }}>
          {/* @ts-ignore */}
          <spline-viewer url="https://prod.spline.design/4PF4J4YenOXJHe4A/scene.splinecode" style={{ position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', transform: 'translate(-50%,-50%) scale(1.1)' }}></spline-viewer>
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-40">
          
          {/* Problem */}
          <FadeIn>
            <div id="problem" className="pt-24 pb-16">
              <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">Das Problem</div>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">
                5–10 Stunden<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">pro Stelle.</span>
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
                Ohne eigene HR-Abteilung wird jede Ausschreibung zur Belastung: 
                unterschiedliche CV-Formate, fehlende Angaben, keine nachvollziehbare Bewertung.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-32">
              {[
                { icon: '⏱️', val: '5–10 h', desc: 'Sichtungsaufwand pro Stelle' },
                { icon: '🛡️', val: '100 %', desc: 'der Schritte im Audit Log' },
                { icon: '⚖️', val: '0', desc: 'automatische Entscheidungen' }
              ].map((s, i) => (
                <Card key={i} className="bg-white/60 backdrop-blur-md border-slate-200/60 shadow-xl shadow-slate-200/40 hover:-translate-y-2 transition-transform duration-300">
                  <CardContent className="p-8 text-center flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white flex items-center justify-center text-2xl mb-4 shadow-lg shadow-indigo-200">
                      {s.icon}
                    </div>
                    <div className="text-4xl font-black text-slate-900 mb-2">{s.val}</div>
                    <div className="text-slate-500 font-medium">{s.desc}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </FadeIn>

          {/* Solution */}
          <FadeIn>
            <div id="loesung" className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center mb-32">
              <div className="order-2 md:order-1 rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 bg-white p-2">
                <img src={IMG_ORB} alt="Solution" className="w-full h-auto rounded-2xl" />
              </div>
              <div className="order-1 md:order-2">
                <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">Die Lösung</div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">
                  Ein Agenten-<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">team</span>, ein Flow.
                </h2>
                <p className="text-xl text-slate-600 leading-relaxed">
                  Vom Stellenprofil bis zur Rückfrage: jeder Agent hat genau eine Aufgabe — 
                  transparent, überprüfbar, nachvollziehbar.
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Steps Detail */}
          <FadeIn>
            <div id="schritte" className="mb-12">
              <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">Im Detail</div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">Drei Schritte. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">Ein Flow.</span></h2>
            </div>
          </FadeIn>
        </div>

        {/* Gallery */}
        <FadeIn>
          <div className="w-full relative mb-32">
            <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute top-0 bottom-0 right-0 w-32 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none"></div>
            
            <div className="flex overflow-x-auto gap-6 px-12 md:px-32 pb-8 snap-x snap-mandatory hide-scrollbar">
              {[
                { img: IMG_STEP_UPLOAD, step: 'SCHRITT 01', title: 'Hochladen', desc: 'Stelle & Lebensläufe rein — als PDF oder Text.' },
                { img: IMG_STEP_ANALYZE, step: 'SCHRITT 02', title: 'Analysieren', desc: 'CV-Agent strukturiert, Matching-Agent prüft jede Anforderung.' },
                { img: IMG_STEP_DECIDE, step: 'SCHRITT 03', title: 'Entscheiden', desc: 'Der Mensch wählt — nie der Algorithmus.' },
                { img: IMG_ORB, step: 'SYSTEM', title: 'Multi-Agent', desc: 'Sechs Agenten, ein sauberer, nachvollziehbarer Flow.' },
                { img: IMG_WAVE, step: 'TRANSPARENZ', title: 'Audit Log', desc: 'Jeder Verarbeitungsschritt lückenlos dokumentiert.' },
              ].map((item, i) => (
                <Card key={i} className="flex-none w-[85vw] md:w-[400px] snap-center overflow-hidden border-slate-200/60 shadow-xl bg-white hover:-translate-y-2 transition-all">
                  <div className="h-64 bg-slate-100 overflow-hidden">
                    <img src={item.img} className="w-full h-full object-cover" alt={item.title} />
                  </div>
                  <CardContent className="p-6">
                    <div className="text-xs font-extrabold tracking-wider text-blue-600 mb-2">{item.step}</div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h4>
                    <p className="text-slate-600 font-medium">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </FadeIn>

        <div className="max-w-6xl mx-auto px-6">
          {/* Results */}
          <FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center mb-32">
              <div>
                <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">Ergebnisse</div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">
                  Struktur statt<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Bauchgefühl.</span>
                </h2>
                <p className="text-xl text-slate-600 leading-relaxed mb-8">
                  Saubere Kandidatenprofile, eine transparente Qualifikationscheckliste und ein 
                  lückenloses Audit Log — Human-in-the-Loop by Design. Keine Rangfolge, keine Empfehlung.
                </p>
                <Button size="lg" onClick={handleStartDemo} className="rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold border-0 shadow-sm">
                  Workspace öffnen &rarr;
                </Button>
              </div>
              <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 bg-white p-2">
                <img src={IMG_DATA} alt="Structured Data" className="w-full h-auto rounded-2xl" />
              </div>
            </div>
          </FadeIn>

          {/* Pricing */}
          <FadeIn>
            <div id="preise" className="text-center mb-12">
              <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">Preise</div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Einfach. Planbar.</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
              {[
                { name: 'Starter', price: '0€', unit: '/ Demo', features: ['Vollständiger Workspace', 'Bis zu 5 Bewerbungen', 'Audit Log'] },
                { name: 'Team', price: '49€', unit: '/ Monat', pop: true, features: ['Unbegrenzte Bewerbungen', 'Alle sechs Agenten', 'Rückfragen-E-Mails', 'Priorisierter Support'] },
                { name: 'Enterprise', price: 'Auf Anfrage', unit: '', features: ['SSO & Rollen', 'Eigene Modelle / API', 'Audit-Export'] }
              ].map((p, i) => (
                <Card key={i} className={cn("relative overflow-hidden bg-white/60 backdrop-blur-md border-slate-200/60 shadow-lg hover:-translate-y-2 transition-transform duration-300", p.pop ? "border-indigo-300 shadow-xl shadow-indigo-100" : "")}>
                  {p.pop && <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">Beliebt</div>}
                  <CardContent className="p-8">
                    <div className="text-lg font-bold text-slate-900 mb-2">{p.name}</div>
                    <div className="text-4xl font-black text-slate-900 mb-6">{p.price}<span className="text-sm text-slate-500 font-semibold">{p.unit}</span></div>
                    <ul className="space-y-3">
                      {p.features.map((f, j) => (
                        <li key={j} className="flex items-center text-slate-600 font-medium">
                          <span className="text-emerald-500 mr-2 font-bold">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </FadeIn>

          {/* Final CTA */}
          <FadeIn>
            <div className="rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-100 p-12 md:p-20 text-center shadow-lg shadow-indigo-100/50">
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">Bereit für den ersten Screening-Lauf?</h2>
              <p className="text-xl text-slate-600 mb-10">Starte in Sekunden — ganz ohne Setup.</p>
              <Button size="lg" onClick={handleStartDemo} className="rounded-full px-10 py-7 text-xl font-bold shadow-xl shadow-indigo-200 bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105 transition-transform border-0 text-white">
                🚀 Demo starten
              </Button>
            </div>
          </FadeIn>

        </div>
      </div>
    </>
  );
};
