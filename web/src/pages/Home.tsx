import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SplineScene } from '../components/SplineScene';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import IMG_ORB from '../assets/orb.webp';
import IMG_DATA from '../assets/data.webp';
import IMG_WAVE from '../assets/wave.webp';
import IMG_STEP_UPLOAD from '../assets/step-upload.webp';
import IMG_STEP_ANALYZE from '../assets/step-analyze.webp';
import IMG_STEP_DECIDE from '../assets/step-decide.webp';

const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
};

export const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();

  const handleStartDemo = () => {
    navigate('/workspace');
  };

  return (
    <>
      <div className="w-full relative bg-slate-50 overflow-x-hidden pb-20">
        {/* Background gradient */}
        <div className="fixed inset-0 pointer-events-none" style={{
          background: 'radial-gradient(1300px 780px at 80% 4%, rgba(124,92,255,.15), transparent 58%), radial-gradient(1150px 700px at 104% -2%, rgba(59,130,246,.12), transparent 56%), radial-gradient(1000px 700px at -6% 2%, rgba(124,92,255,.08), transparent 60%)'
        }}></div>

        {/* 1) Hero — robot Spline behind the headline */}
        <div className="relative w-full h-[100vh] min-h-[640px] -mt-4">
          <div className="absolute inset-0 z-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent_92%)]">
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(1100px 700px at 72% 38%, rgba(124,92,255,.22), transparent 60%), radial-gradient(900px 600px at 60% 20%, rgba(59,130,246,.18), transparent 58%), linear-gradient(180deg,#fbfbff 0%, #f1f2fb 100%)',
              }}
            />
          </div>
          {/* Left-side legibility wash over the scene. */}
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-50 via-slate-50/70 to-transparent"></div>

          <div className="absolute top-1/2 left-[5%] md:left-[10%] xl:left-[calc(50vw-530px)] -translate-y-1/2 max-w-xl z-20 px-4">
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">
                {t('home.heroSubtitle')}
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.05] mb-6">
                {t('home.heroTitleLine1')}<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500">
                  {t('home.heroTitleLine2')}
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-lg mb-8">
                {t('home.heroDesc')}
              </p>
              <Button size="lg" onClick={handleStartDemo} className="rounded-full px-8 py-6 text-lg font-bold shadow-xl shadow-indigo-200 bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105 transition-transform border-0 text-white">
                {t('home.startDemo')}
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

        <div className="max-w-6xl mx-auto px-6 relative z-40">
          
          {/* Problem */}
          <FadeIn>
            <div id="problem" className="pt-24 pb-16">
              <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">{t('home.problemLabel')}</div>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">
                {t('home.problemTitleLine1')}<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">{t('home.problemTitleLine2')}</span>
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
                {t('home.problemDesc')}
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-32">
              {[
                { icon: '⏱️', val: '5–10 h', desc: t('home.metric1') },
                { icon: '🛡️', val: '100 %', desc: t('home.metric2') },
                { icon: '⚖️', val: '0', desc: t('home.metric3') }
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
                <img src={IMG_ORB} alt="Illustration des Agenten-Teams" width={1376} height={768} loading="lazy" decoding="async" className="w-full h-auto rounded-2xl" />
              </div>
              <div className="order-1 md:order-2">
                <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">{t('home.solutionLabel')}</div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">
                  {t('home.solutionTitleLine1')}<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">{t('home.solutionTitleLine2')}</span>{t('home.solutionTitleLine3')}
                </h2>
                <p className="text-xl text-slate-600 leading-relaxed">
                  {t('home.solutionDesc')}
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Steps Detail */}
          <FadeIn>
            <div id="schritte" className="mb-12">
              <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">{t('home.stepsLabel')}</div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">{t('home.stepsTitle')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">{t('home.stepsTitle2')}</span></h2>
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
                { img: IMG_STEP_UPLOAD, step: t('home.step1Label'), title: t('home.step1Title'), desc: t('home.step1Desc') },
                { img: IMG_STEP_ANALYZE, step: t('home.step2Label'), title: t('home.step2Title'), desc: t('home.step2Desc') },
                { img: IMG_STEP_DECIDE, step: t('home.step3Label'), title: t('home.step3Title'), desc: t('home.step3Desc') },
                { img: IMG_ORB, step: t('home.step4Label'), title: t('home.step4Title'), desc: t('home.step4Desc') },
                { img: IMG_WAVE, step: t('home.step5Label'), title: t('home.step5Title'), desc: t('home.step5Desc') },
              ].map((item, i) => (
                <Card key={i} className="flex-none w-[85vw] md:w-[400px] snap-center overflow-hidden border-slate-200/60 shadow-xl bg-white hover:-translate-y-2 transition-all">
                  <div className="h-64 bg-slate-100 overflow-hidden">
                    <img src={item.img} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="" />
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
                <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">{t('home.resultsLabel')}</div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">
                  {t('home.resultsTitleLine1')}<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">{t('home.resultsTitleLine2')}</span>
                </h2>
                <p className="text-xl text-slate-600 leading-relaxed mb-8">
                  {t('home.resultsDesc')}
                </p>
                <Button size="lg" onClick={handleStartDemo} className="rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold border-0 shadow-sm">
                  {t('nav.openWorkspace')}
                </Button>
              </div>
              <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 bg-white p-2">
                <img src={IMG_DATA} alt="Strukturierte Kandidatendaten und Qualifikationscheckliste" width={1376} height={768} loading="lazy" decoding="async" className="w-full h-auto rounded-2xl" />
              </div>
            </div>
          </FadeIn>

          {/* Pricing */}
          <FadeIn>
            <div id="preise" className="text-center mb-12">
              <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4">{t('home.pricingLabel')}</div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">{t('home.pricingTitle')}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
              {[
                { name: t('home.plan1Name'), price: '0€', unit: t('home.plan1Unit'), features: [t('home.plan1F1'), t('home.plan1F2'), t('home.plan1F3')] },
                { name: t('home.plan2Name'), price: '49€', unit: t('home.plan2Unit'), pop: true, features: [t('home.plan2F1'), t('home.plan2F2'), t('home.plan2F3'), t('home.plan2F4')] },
                { name: t('home.plan3Name'), price: t('home.plan3Price'), unit: '', features: [t('home.plan3F1'), t('home.plan3F2'), t('home.plan3F3')] }
              ].map((p, i) => (
                <Card key={i} className={cn("relative overflow-hidden bg-white/60 backdrop-blur-md border-slate-200/60 shadow-lg hover:-translate-y-2 transition-transform duration-300", p.pop ? "border-indigo-300 shadow-xl shadow-indigo-100" : "")}>
                  {p.pop && <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">{t('home.plan2Pop')}</div>}
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
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-6">{t('home.ctaTitle')}</h2>
              <p className="text-xl text-slate-600 mb-10">{t('home.ctaDesc')}</p>
              <Button size="lg" onClick={handleStartDemo} className="rounded-full px-10 py-7 text-xl font-bold shadow-xl shadow-indigo-200 bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105 transition-transform border-0 text-white">
                {t('home.startDemo')}
              </Button>
            </div>
          </FadeIn>

        </div>
      </div>
    </>
  );
};
