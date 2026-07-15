import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { Intro } from '../components/Intro';
import { Play, Sparkles, Shield, Zap } from 'lucide-react';
import { apiClient } from '../api/client';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { hasSeenIntro, setJobProfileText, clearCandidates, addCandidate, setActiveBackend } = useSessionStore();

  const handleStartSandbox = () => {
    setActiveBackend('Rule-Based Sandbox');
    navigate('/workspace');
  };

  const handleLoadDemo = async () => {
    try {
      const demoData = await apiClient.getDemoData();
      setJobProfileText(demoData.job_text);
      clearCandidates();
      demoData.cvs.forEach(cv => {
        addCandidate(cv.name, cv.text);
      });
      navigate('/workspace');
    } catch (e) {
      console.error("Failed to load demo data:", e);
    }
  };

  return (
    <>
      <Intro />
      <div className="block-container" style={{ margin: '0 auto', opacity: hasSeenIntro ? 1 : 0, transition: 'opacity 0.8s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px', marginTop: '60px' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: '0 0 16px' }}>
            Next-Gen <span style={{ color: 'var(--rai-purple)' }}>Recruiting</span>.
          </h1>
          <p className="lead" style={{ margin: '0 auto' }}>
            Erleben Sie den gesamten HR-Prozess von der Anforderungsanalyse bis zur E-Mail — 
            vollautomatisiert, transparent und DS-GVO-konform.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '30px' }}>
            <button 
              className="stButton" 
              onClick={handleStartSandbox}
              style={{
                background: 'linear-gradient(135deg, var(--rai-purple), var(--rai-blue))',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <Play size={18} /> Sandbox starten
            </button>
            <button 
              onClick={handleLoadDemo}
              style={{
                background: 'rgba(255,255,255,0.8)',
                color: 'var(--rai-ink)',
                border: '1px solid rgba(124,92,255,0.25)',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Demo-Daten laden
            </button>
          </div>
        </div>

        <div className="section">
          <span className="eyebrow">Plattform-Architektur</span>
          <h2>Wie es funktioniert</h2>
          <div className="grid grid-3" style={{ marginTop: '30px' }}>
            <div className="card">
              <div className="ic"><Sparkles size={24} /></div>
              <h3>1. Smart Profile Parsing</h3>
              <p>KI analysiert unstrukturierte Stellenbeschreibungen und extrahiert exakte Muss- und Kann-Anforderungen.</p>
            </div>
            <div className="card">
              <div className="ic"><Shield size={24} /></div>
              <h3>2. Privacy-First Matching</h3>
              <p>Lebensläufe werden anonymisiert, bevor das LLM sie objektiv mit dem Profil abgleicht.</p>
            </div>
            <div className="card">
              <div className="ic"><Zap size={24} /></div>
              <h3>3. Actionable Output</h3>
              <p>Generiert strukturierte Audit-Logs und personalisierte E-Mail-Entwürfe (Zusage/Absage).</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
