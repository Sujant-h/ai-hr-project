import React, { useState } from 'react';
import { useSessionStore } from '../store/session';
import { apiClient } from '../api/client';
import { Upload, Play, CheckCircle, FileText, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    setIsAnalyzing
  } = useSessionStore();

  const [activeTab, setActiveTab] = useState(1);

  const handleParseJob = async () => {
    if (!jobProfile.rawText) return;
    try {
      const result = await apiClient.parseJobProfile(jobProfile.rawText);
      setParsedJobProfile(result);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunAnalysis = async () => {
    if (!jobProfile.rawText || candidates.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = await apiClient.runAnalysis(jobProfile.rawText, candidates);
      setAnalysisResult(result);
      setActiveTab(3);
    } catch (e) {
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
      if (file.type === 'application/pdf') {
        // Streamlit handled PyPDF extraction on the backend, 
        // but here we just read it as text or send the raw bytes to /cv/extract?
        // Wait, the new API takes { filename, text } and the extractor expects raw text.
        // We'll read it as text for now (this is simplified; in a real app, you'd send formData with the PDF).
        // Since the demo loads the text directly, let's just use text files for manual upload for now.
        alert('PDF upload requires formData backend modification. Use Demo-Daten for now.');
      } else {
        const text = await file.text();
        const extracted = await apiClient.extractCv(file.name, text);
        addCandidate(extracted.filename, extracted.raw_text);
      }
    }
  };

  return (
    <div className="block-container" style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ margin: 0, cursor: 'pointer' }} onClick={() => navigate('/')}>
          AI HR <span style={{ color: 'var(--rai-purple)' }}>Workspace</span>
        </h1>
        <div className="eyebrow" style={{ margin: 0 }}>Backend: {activeBackend}</div>
      </header>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        {[1, 2, 3].map(step => (
          <button 
            key={step}
            onClick={() => setActiveTab(step)}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              border: activeTab === step ? '2px solid var(--rai-purple)' : '1px solid #e2e8f0',
              background: activeTab === step ? 'rgba(124,92,255,0.05)' : 'white',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Step {step}: {step === 1 ? 'Job Profile' : step === 2 ? 'Candidates' : 'Analysis'}
          </button>
        ))}
      </div>

      <div className="glass">
        {activeTab === 1 && (
          <div>
            <h2>1. Stellenprofil definieren</h2>
            <textarea 
              value={jobProfile.rawText}
              onChange={e => setJobProfileText(e.target.value)}
              placeholder="Fügen Sie hier die Stellenbeschreibung ein..."
              style={{ width: '100%', height: '200px', padding: '16px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '20px', fontFamily: 'inherit' }}
            />
            <button className="stButton" onClick={handleParseJob} style={{ background: 'var(--rai-purple)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>
              Profil analysieren
            </button>

            {jobProfile.parsedProfile && (
              <div style={{ marginTop: '30px', background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={20} color="var(--rai-purple)" /> Extrahierte Anforderungen</h3>
                <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
                  {jobProfile.parsedProfile.requirements?.map((req: any, i: number) => (
                    <li key={i} style={{ marginBottom: '8px' }}>
                      <strong>{req.category}:</strong> {req.description} ({req.is_must_have ? 'Muss' : 'Kann'})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 2 && (
          <div>
            <h2>2. Lebensläufe hochladen</h2>
            <div style={{ padding: '40px', border: '2px dashed #ccc', borderRadius: '12px', textAlign: 'center', marginBottom: '30px' }}>
              <Upload size={32} color="var(--rai-muted)" style={{ marginBottom: '10px' }} />
              <p>Ziehen Sie PDFs oder Textdateien hierher</p>
              <input type="file" multiple onChange={handleFileUpload} accept=".txt,.pdf" />
            </div>

            {candidates.length > 0 && (
              <div>
                <h3>Aktuelle Kandidaten ({candidates.length})</h3>
                <div className="grid grid-2">
                  {candidates.map((c, i) => (
                    <div key={i} className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={20} color="var(--rai-blue)" />
                        <strong>{c.filename}</strong>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                  style={{
                    marginTop: '30px',
                    background: 'linear-gradient(135deg, var(--rai-purple), var(--rai-blue))',
                    color: 'white',
                    border: 'none',
                    padding: '14px 28px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                    opacity: isAnalyzing ? 0.7 : 1
                  }}
                >
                  <Play size={20} /> {isAnalyzing ? 'Analysiere...' : 'Gesamtanalyse starten'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 3 && (
          <div>
            <h2>3. Analyse-Ergebnisse</h2>
            {!analysisResult && !isAnalyzing && <p>Keine Ergebnisse vorhanden. Bitte starten Sie die Analyse in Schritt 2.</p>}
            {isAnalyzing && <p>Die KI analysiert gerade alle Kandidaten. Bitte warten...</p>}
            {analysisResult && (
              <div>
                <p>Analyse abgeschlossen in {analysisResult.duration_seconds.toFixed(2)}s.</p>
                {analysisResult.candidate_results.map((res: any, i: number) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>{res.filename}</h3>
                    <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '99px', background: res.decision.is_match ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: res.decision.is_match ? '#166534' : '#991b1b', fontWeight: 600, marginBottom: '16px' }}>
                      {res.decision.is_match ? 'Match' : 'Kein Match'}
                    </div>
                    <p><strong>Begründung:</strong> {res.decision.reasoning}</p>
                    
                    <div style={{ marginTop: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={16} /> Automatischer E-Mail Entwurf</h4>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, color: 'var(--rai-muted)' }}>
                        {res.email_draft}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
