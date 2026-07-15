import React, { useState } from 'react';
import { useSessionStore } from '../store/session';
import { apiClient } from '../api/client';
import { Upload, Play, CheckCircle, FileText, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuditLog } from '../components/AuditLog';
import { CandidateDetail } from '../components/CandidateDetail';

export const Workspace: React.FC = () => {
  const navigate = useNavigate();
  const { 
    activeBackend, 
    jobProfile, 
    setJobProfileText, 
    setParsedJobProfile,
    candidates,
    addCandidate,
    analysisResult,
    setAnalysisResult,
    isAnalyzing,
    setIsAnalyzing,
    addAuditLogEntry,
    setSelectedCandidateId
  } = useSessionStore();

  const [activeTab, setActiveTab] = useState(1);

  const handleParseJob = async () => {
    if (!jobProfile.rawText) return;
    addAuditLogEntry('System', 'Analyse gestartet', 'Beginne mit der Extraktion des Stellenprofils...');
    try {
      const result = await apiClient.parseJobProfile(jobProfile.rawText);
      setParsedJobProfile(result);
      addAuditLogEntry('LLM Intelligence', 'Analyse abgeschlossen', `Stellenprofil erfolgreich extrahiert (${result.requirements?.length || 0} Anforderungen gefunden).`);
    } catch (e: any) {
      addAuditLogEntry('System', 'Fehler', `Fehler bei der Analyse: ${e.message}`);
      console.error(e);
    }
  };

  const handleRunAnalysis = async () => {
    if (!jobProfile.rawText || candidates.length === 0) return;
    setIsAnalyzing(true);
    addAuditLogEntry('System', 'Gesamtanalyse gestartet', `Starte Abgleich für ${candidates.length} Kandidaten.`);
    try {
      const result = await apiClient.runAnalysis(jobProfile.rawText, candidates);
      setAnalysisResult(result);
      addAuditLogEntry('LLM Intelligence', 'Analyse abgeschlossen', `Matching für alle Kandidaten beendet (Dauer: ${result.duration_seconds?.toFixed(2)}s).`);
      setActiveTab(3); // Jump to candidates tab
    } catch (e: any) {
      addAuditLogEntry('System', 'Fehler', `Fehler beim Abgleich: ${e.message}`);
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      addAuditLogEntry('System', 'Upload', `Datei hochgeladen: ${file.name}`);
      if (file.type === 'application/pdf') {
        alert('PDF upload requires formData backend modification. Use Demo-Daten for now.');
      } else {
        const text = await file.text();
        addAuditLogEntry('System', 'CV Extraktion', `Starte Textextraktion für ${file.name}`);
        const extracted = await apiClient.extractCv(file.name, text);
        addCandidate(extracted.filename, extracted.raw_text);
        addAuditLogEntry('LLM Intelligence', 'Extraktion erfolgreich', `Lebenslauf verarbeitet: ${extracted.filename}`);
      }
    }
  };

  const tabs = [
    { id: 1, label: '① Stellenprofil' },
    { id: 2, label: '② Bewerbungen' },
    { id: 3, label: '③ Kandidaten' },
    { id: 4, label: '④ Informationslücken' },
    { id: 5, label: '⑤ Rückfragen' },
    { id: 6, label: '⑥ Audit Log' },
  ];

  return (
    <>
      <div className="block-container" style={{ padding: '0 20px', maxWidth: '1180px', margin: '0 auto', paddingTop: '.7rem', paddingBottom: '4rem' }}>
        
        {/* Spline graphic as a header background */}
        <div style={{ position: 'relative', width: '100vw', marginLeft: 'calc(50% - 50vw)', height: '300px', background: 'transparent', overflow: 'hidden', WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%), linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)', WebkitMaskComposite: 'source-in' }}>
          {/* @ts-ignore */}
          <spline-viewer url="https://prod.spline.design/4PF4J4YenOXJHe4A/scene.splinecode" style={{ position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', transform: 'translate(-50%,-50%) scale(1.1)', transformOrigin: 'center center' }}></spline-viewer>
        </div>

        <div className="ws-head">
          <div className="ws-copy section">
            <span className="eyebrow">Recruiting Workspace</span>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.4vw,2.6rem)' }}>Dein Screening-Arbeitsbereich</h2>
            <p className="lead" style={{ marginBottom: '30px' }}>
              Stellenprofil definieren, Bewerbungen analysieren und Ergebnisse transparent prüfen — die Entscheidung bleibt bei dir.
            </p>
          </div>
        </div>

        {activeBackend === 'Rule-Based Sandbox' && (
          <div className="hitl" style={{ marginBottom: '30px' }}>
            ⚠️ <b>Kein LLM aktiv:</b> Die Agenten laufen im regelbasierten Sandbox-Modus. Für vollständige Analysen bitte den Backend auf "LLM Intelligence" umstellen (sofern API-Key vorhanden).
          </div>
        )}

        {/* Horizontal Streamlit-style Tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid rgba(124,92,255,.15)', marginBottom: '30px', paddingBottom: '1px' }}>
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--rai-purple)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--rai-ink)' : 'var(--rai-muted)',
                fontWeight: activeTab === tab.id ? 600 : 500,
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'all 0.2s',
                marginBottom: '-1px', // pull down to overlap the container's border
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ minHeight: '600px' }}>
          
          {activeTab === 1 && (
            <div>
              <div className="section" style={{ marginTop: 0 }}>
                <h2>Stellenprofil definieren</h2>
                <p className="lead">Füge die Anforderungen der Stelle ein, um sie von der KI strukturieren zu lassen.</p>
              </div>
              <textarea 
                value={jobProfile.rawText}
                onChange={e => setJobProfileText(e.target.value)}
                placeholder="Fügen Sie hier die Stellenbeschreibung ein..."
                style={{ width: '100%', height: '250px', padding: '16px', borderRadius: '12px', border: '1px solid rgba(124,92,255,.2)', marginBottom: '20px', fontFamily: 'inherit', resize: 'vertical' }}
              />
              <div className="stButton">
                <button data-kind="primary" onClick={handleParseJob} style={{ cursor: 'pointer', background: 'linear-gradient(135deg,var(--rai-purple),var(--rai-blue))', color: '#fff', border: 'none', boxShadow: '0 12px 30px rgba(124,92,255,.40)' }}>
                  ✨ Profil analysieren
                </button>
              </div>

              {jobProfile.parsedProfile && (
                <div style={{ marginTop: '40px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rai-ink)' }}>
                    <CheckCircle size={22} color="var(--rai-purple)" /> Extrahierte Anforderungen
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                    {jobProfile.parsedProfile.requirements?.map((req: any, i: number) => (
                      <div key={i} className="cand" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                          <b>{req.category}:</b> {req.description}
                        </span>
                        <span className={`pill ${req.is_must_have ? 'pill-open' : 'pill-ok'}`}>
                          {req.is_must_have ? 'Muss' : 'Kann'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 2 && (
            <div>
              <div className="section" style={{ marginTop: 0 }}>
                <h2>Bewerbungen hochladen</h2>
                <p className="lead">Lade Lebensläufe hoch, um sie gegen das Profil zu prüfen.</p>
              </div>
              
              <div style={{ padding: '50px', border: '2px dashed rgba(124,92,255,.3)', borderRadius: '16px', textAlign: 'center', marginBottom: '40px', background: 'rgba(255,255,255,.5)' }}>
                <Upload size={36} color="var(--rai-purple)" style={{ marginBottom: '16px' }} />
                <p style={{ fontWeight: 600, color: 'var(--rai-ink)', fontSize: '1.15rem', marginBottom: '8px' }}>Ziehe Textdateien hierher (.txt)</p>
                <p style={{ color: 'var(--rai-muted)', fontSize: '0.95rem', marginBottom: '24px' }}>oder wähle sie manuell aus deinem Dateisystem</p>
                <label style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 28px', 
                  background: 'linear-gradient(135deg,var(--rai-purple),var(--rai-blue))', 
                  color: 'white', 
                  borderRadius: '999px', 
                  cursor: 'pointer',
                  fontWeight: 600,
                  boxShadow: '0 8px 24px rgba(124,92,255,.3)',
                  transition: 'all 0.2s'
                }} className="hover-lift">
                  Dateien durchsuchen...
                  <input type="file" multiple onChange={handleFileUpload} accept=".txt" style={{ display: 'none' }} />
                </label>
              </div>

              {candidates.length > 0 && (
                <div>
                  <h3 style={{ marginBottom: '20px' }}>Aktuelle Kandidaten ({candidates.length})</h3>
                  <div className="grid grid-2">
                    {candidates.map((c, i) => (
                      <div key={i} className="cand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileText size={24} color="var(--rai-blue)" />
                        <strong style={{ fontSize: '1.05rem', color: 'var(--rai-ink)' }}>{c.filename}</strong>
                      </div>
                    ))}
                  </div>
                  
                  <div className="stButton" style={{ marginTop: '40px' }}>
                    <button 
                      data-kind="primary"
                      onClick={handleRunAnalysis}
                      disabled={isAnalyzing}
                      style={{ cursor: isAnalyzing ? 'not-allowed' : 'pointer', opacity: isAnalyzing ? 0.7 : 1, background: 'linear-gradient(135deg,var(--rai-purple),var(--rai-blue))', color: '#fff', border: 'none', boxShadow: '0 12px 30px rgba(124,92,255,.40)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Play size={18} /> 
                      {isAnalyzing ? 'Analysiere...' : 'Gesamtanalyse starten'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 3 && (
            <div>
              <div className="section" style={{ marginTop: 0 }}>
                <h2>Kandidaten-Ranking</h2>
                <p className="lead">Übersicht der Matching-Ergebnisse für alle Bewerber.</p>
              </div>

              {!analysisResult && !isAnalyzing && <div className="hitl">Noch keine Analyse durchgeführt. (Gehe zu ② Bewerbungen)</div>}
              {isAnalyzing && <div className="hitl">⏳ Die Agenten arbeiten im Hintergrund...</div>}
              
              {analysisResult && (
                <div className="grid grid-2">
                  {analysisResult.candidate_results.map((res: any, i: number) => (
                    <div key={i} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <h3>{res.filename}</h3>
                        <span className={`pill ${res.decision.is_match ? 'pill-ok' : 'pill-no'}`}>
                          {res.decision.is_match ? 'Match' : 'Kein Match'}
                        </span>
                      </div>
                      <p style={{ marginBottom: '20px', minHeight: '60px' }}>{res.decision.reasoning}</p>
                      
                      <div className="stButton">
                        <button onClick={() => setSelectedCandidateId(res.filename)} style={{ width: '100%', cursor: 'pointer' }}>
                          Profil ansehen →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 4 && (
            <div>
              <div className="section" style={{ marginTop: 0 }}>
                <h2>Informationslücken</h2>
                <p className="lead">Fehlende Informationen aus den Lebensläufen, die für das Matching relevant sind.</p>
              </div>
              
              {!analysisResult && <div className="hitl">Noch keine Analyse durchgeführt.</div>}
              
              {analysisResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {analysisResult.candidate_results.map((res: any, i: number) => {
                    const gaps = res.gaps || [];
                    if (gaps.length === 0) return null;
                    
                    return (
                      <div key={i} className="cand" style={{ padding: '20px' }}>
                        <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          👤 {res.filename}
                        </h3>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--rai-ink)' }}>
                          {gaps.map((g: any, j: number) => (
                            <li key={j} style={{ marginBottom: '8px' }}>
                              <b>{g.requirement}:</b> {g.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  {analysisResult.candidate_results.every((r: any) => !r.gaps || r.gaps.length === 0) && (
                    <div className="hitl">Keine Informationslücken gefunden!</div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 5 && (
            <div>
              <div className="section" style={{ marginTop: 0 }}>
                <h2>Rückfragen & E-Mails</h2>
                <p className="lead">Vorgeschlagene Fragen und automatisch generierte E-Mail-Entwürfe.</p>
              </div>

              {!analysisResult && <div className="hitl">Noch keine Analyse durchgeführt.</div>}

              {analysisResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {analysisResult.candidate_results.map((res: any, i: number) => (
                    <div key={i} className="cand" style={{ padding: '24px' }}>
                      <h3 style={{ margin: '0 0 16px 0' }}>👤 {res.filename}</h3>
                      
                      {(res.questions && res.questions.length > 0) && (
                        <div style={{ marginBottom: '20px' }}>
                          <b style={{ color: 'var(--rai-purple)' }}>Vorgeschlagene Fragen:</b>
                          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                            {res.questions.map((q: string, j: number) => <li key={j}>{q}</li>)}
                          </ul>
                        </div>
                      )}

                      {res.email_draft && (
                        <div style={{ background: 'rgba(255,255,255,.5)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(124,92,255,.1)' }}>
                          <h4 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Mail size={16} /> Entwurf (Vorschau)
                          </h4>
                          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, color: 'var(--rai-muted)', fontSize: '0.95rem' }}>
                            {res.email_draft}
                          </pre>
                          
                          <a 
                            href={`mailto:?subject=Rückfrage zu Ihrer Bewerbung&body=${encodeURIComponent(res.email_draft)}`}
                            className="navbtn"
                            style={{
                              display: 'inline-block', marginTop: '16px', background: 'var(--rai-ink)', color: '#fff',
                              padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600
                            }}
                          >
                            📧 In E-Mail-Programm öffnen
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 6 && <AuditLog />}

        </div>
      </div>
      <CandidateDetail />
    </>
  );
};
