import React from 'react';
import { useSessionStore } from '../store/session';

export const CandidateDetail: React.FC = () => {
  const { candidates, analysisResult, selectedCandidateId, setSelectedCandidateId } = useSessionStore();

  if (!selectedCandidateId) return null;

  // Find the candidate from the results
  const result = analysisResult?.candidate_results?.find((r: any) => r.filename === selectedCandidateId);
  const rawCandidate = candidates.find(c => c.filename === selectedCandidateId);

  // If no analysis result yet, just show raw data or placeholder
  if (!result) {
    return (
      <div style={overlayStyle} onClick={() => setSelectedCandidateId(null)}>
        <div style={drawerStyle} onClick={e => e.stopPropagation()}>
          <button onClick={() => setSelectedCandidateId(null)} className="navbtn" style={backBtnStyle}>← Zurück</button>
          <div className="section" style={{ marginTop: '14px' }}>
            <span className="eyebrow">Kandidatenprofil</span>
            <h2>👤 {selectedCandidateId}</h2>
            <div className="hitl" style={{ marginTop: '20px' }}>
              Noch kein Abgleich für diese:n Kandidat:in durchgeführt.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const matches = result.matches || [];
  const gaps = result.gaps || [];
  const questions = result.questions || [];
  
  const met = matches.filter((m: any) => m.status === 'erfuellt').length;
  const total = matches.length;

  return (
    <div style={overlayStyle} onClick={() => setSelectedCandidateId(null)}>
      <div style={drawerStyle} onClick={e => e.stopPropagation()}>
        <button onClick={() => setSelectedCandidateId(null)} className="navbtn" style={backBtnStyle}>← Zurück</button>
        
        <div className="section" style={{ marginTop: '20px' }}>
          <span className="eyebrow">Kandidatenprofil</span>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>👤 {selectedCandidateId}</h2>
          <p className="lead">
            {met}/{total} Anforderungen erfüllt &middot; {gaps.length} Informationslücke(n)
          </p>
        </div>

        <div className="grid grid-2" style={{ marginBottom: '30px' }}>
          <div className="stat" style={{ padding: '20px' }}>
            <span className="n" style={{ fontSize: '2rem' }}>{result.extracted_profile?.skills?.length || 0}</span>
            <div className="l">Skills erkannt</div>
          </div>
          <div className="stat c2" style={{ padding: '20px' }}>
            <span className="n" style={{ fontSize: '2rem' }}>{result.extracted_profile?.languages?.length || 0}</span>
            <div className="l">Sprachen</div>
          </div>
        </div>

        {result.extracted_profile?.skills && result.extracted_profile.skills.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            {result.extracted_profile.skills.map((s: string, i: number) => (
              <span key={i} className="tag">{s}</span>
            ))}
          </div>
        )}

        <h4 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--rai-ink)' }}>Qualifikationscheckliste</h4>
        {matches.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '30px' }}>
            {matches.map((m: any, i: number) => {
              const isMatch = m.status === 'erfuellt';
              const pillClass = isMatch ? 'pill-ok' : (m.status === 'teilweise' ? 'pill-part' : 'pill-no');
              const label = isMatch ? 'Erfüllt' : (m.status === 'teilweise' ? 'Teilweise' : 'Nicht erfüllt');
              return (
                <div key={i} className="cand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
                  <span>
                    <b>{m.requirement}</b> <span className="meta">&middot; {m.note}</span>
                  </span>
                  <span className={`pill ${pillClass}`}>{label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="meta">Keine Anforderungen zum Abgleich gefunden.</p>
        )}

        {gaps.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--rai-ink)' }}>🧩 Informationslücken</h4>
            <ul style={{ paddingLeft: '20px' }}>
              {gaps.map((g: any, i: number) => (
                <li key={i} style={{ marginBottom: '8px' }}>
                  <strong>{g.requirement}</strong> &mdash; {g.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {questions.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--rai-ink)' }}>💬 Vorgeschlagene Rückfragen</h4>
            <ul style={{ paddingLeft: '20px' }}>
              {questions.map((q: string, i: number) => (
                <li key={i} style={{ marginBottom: '8px' }}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="hitl" style={{ marginTop: '20px' }}>
          ⚖️ <b>Human-in-the-Loop:</b> Diese Ansicht zeigt nur extrahierte Daten &mdash; keine Bewertung, keine Empfehlung. Die Entscheidung triffst du.
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(15, 18, 38, 0.4)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  zIndex: 9999,
  display: 'flex',
  justifyContent: 'flex-end'
};

const drawerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '700px',
  height: '100%',
  backgroundColor: '#fbfbff',
  boxShadow: '-10px 0 40px rgba(31,38,93,.15)',
  padding: '40px',
  overflowY: 'auto',
  position: 'relative',
  borderLeft: '1px solid rgba(124,92,255,.12)'
};

const backBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,.7)',
  border: '1px solid rgba(124,92,255,.18)',
  padding: '8px 16px',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 600,
  color: 'var(--rai-ink)'
};
