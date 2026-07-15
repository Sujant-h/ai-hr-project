import React, { useState } from 'react';
import { useSessionStore } from '../store/session';
import { apiClient } from '../api/client';
import { Upload, Play, CheckCircle, FileText, Mail, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuditLog } from '../components/AuditLog';
import { CandidateDetail } from '../components/CandidateDetail';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
      setActiveTab(3);
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

  const TabContent = motion.div;

  return (
    <>
      <div className="w-full relative bg-slate-50 min-h-screen pt-4 pb-20">
        
        {/* Spline Background Area */}
        <div className="absolute top-0 left-0 right-0 h-[300px] pointer-events-none z-0" style={{
          WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 22%, black 78%, transparent 100%)'
        }}>
          {/* @ts-ignore */}
          <spline-viewer url="https://prod.spline.design/4PF4J4YenOXJHe4A/scene.splinecode" style={{ position: 'absolute', top: '50%', left: '50%', width: '100%', height: '100%', transform: 'translate(-50%,-50%) scale(1.1)' }}></spline-viewer>
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="pt-24 pb-12">
            <div className="text-sm font-extrabold tracking-widest text-indigo-700 uppercase mb-4 drop-shadow-sm">Recruiting Workspace</div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4 drop-shadow-sm">Dein Screening-Arbeitsbereich</h2>
            <p className="text-xl text-slate-700 max-w-2xl leading-relaxed drop-shadow-md">
              Stellenprofil definieren, Bewerbungen analysieren und Ergebnisse transparent prüfen — die Entscheidung bleibt bei dir.
            </p>
          </div>

          {activeBackend === 'Rule-Based Sandbox' && (
            <div className="bg-amber-50/80 backdrop-blur border border-amber-200 text-amber-900 px-6 py-4 rounded-2xl mb-8 shadow-sm flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <p className="text-sm font-medium">
                <b className="font-bold">Kein LLM aktiv:</b> Die Agenten laufen im regelbasierten Sandbox-Modus. Für vollständige Analysen bitte den Backend auf "LLM Intelligence" umstellen.
              </p>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-200 mb-8 hide-scrollbar">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-6 py-4 text-[15px] font-semibold whitespace-nowrap transition-all border-b-2 -mb-[1px]",
                  activeTab === tab.id 
                    ? "border-indigo-600 text-indigo-700" 
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-[600px]">
            <AnimatePresence mode="wait">
              <TabContent 
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* TAB 1 */}
                {activeTab === 1 && (
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">Stellenprofil definieren</h2>
                      <p className="text-slate-600">Füge die Anforderungen der Stelle ein, um sie von der KI strukturieren zu lassen.</p>
                    </div>
                    <textarea 
                      value={jobProfile.rawText}
                      onChange={e => setJobProfileText(e.target.value)}
                      placeholder="Fügen Sie hier die Stellenbeschreibung ein..."
                      className="w-full h-64 p-5 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-y mb-6 font-medium text-slate-700"
                    />
                    <Button onClick={handleParseJob} size="lg" className="rounded-xl px-8 shadow-lg shadow-indigo-200 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-base border-0">
                      ✨ Profil analysieren
                    </Button>

                    {jobProfile.parsedProfile && (
                      <div className="mt-12 animate-in slide-in-from-bottom-4 fade-in duration-500">
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900 mb-6">
                          <CheckCircle className="text-emerald-500" size={24} /> Extrahierte Anforderungen
                        </h3>
                        <div className="flex flex-col gap-3">
                          {jobProfile.parsedProfile.requirements?.map((req: any, i: number) => (
                            <Card key={i} className="bg-white border-slate-200/60 shadow-sm rounded-xl">
                              <CardContent className="p-5 flex justify-between items-center gap-4">
                                <div className="text-slate-700">
                                  <strong className="text-slate-900 font-bold">{req.category}:</strong> {req.description}
                                </div>
                                <Badge className={cn("px-3 py-1 font-bold rounded-lg whitespace-nowrap shadow-none", req.is_must_have ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100")}>
                                  {req.is_must_have ? 'Muss' : 'Kann'}
                                </Badge>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2 */}
                {activeTab === 2 && (
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">Bewerbungen hochladen</h2>
                      <p className="text-slate-600">Lade Lebensläufe hoch, um sie gegen das Profil zu prüfen.</p>
                    </div>
                    
                    <div className="border-2 border-dashed border-indigo-200/80 rounded-3xl p-12 text-center mb-10 bg-white/40 backdrop-blur">
                      <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                        <Upload size={32} className="text-indigo-600" />
                      </div>
                      <p className="text-xl font-bold text-slate-900 mb-2">Ziehe Textdateien hierher (.txt)</p>
                      <p className="text-slate-500 font-medium mb-8">oder wähle sie manuell aus deinem Dateisystem</p>
                      <label className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105 transition-transform text-white rounded-full cursor-pointer font-bold shadow-xl shadow-indigo-200">
                        Dateien durchsuchen...
                        <input type="file" multiple onChange={handleFileUpload} accept=".txt" className="hidden" />
                      </label>
                    </div>

                    {candidates.length > 0 && (
                      <div className="animate-in slide-in-from-bottom-4 fade-in duration-500">
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Aktuelle Kandidaten ({candidates.length})</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                          {candidates.map((c, i) => (
                            <Card key={i} className="bg-white border-slate-200/60 shadow-sm rounded-xl hover:-translate-y-1 transition-transform">
                              <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                  <FileText size={20} />
                                </div>
                                <strong className="text-slate-900 font-semibold truncate">{c.filename}</strong>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        
                        <Button 
                          onClick={handleRunAnalysis}
                          disabled={isAnalyzing}
                          size="lg"
                          className="rounded-xl px-8 shadow-lg shadow-indigo-200 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-base border-0 flex items-center gap-2"
                        >
                          <Play size={18} fill="currentColor" /> 
                          {isAnalyzing ? 'Analysiere...' : 'Gesamtanalyse starten'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3 */}
                {activeTab === 3 && (
                  <div className="max-w-6xl mx-auto">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">Kandidaten-Ranking</h2>
                      <p className="text-slate-600">Übersicht der Matching-Ergebnisse für alle Bewerber.</p>
                    </div>

                    {!analysisResult && !isAnalyzing && (
                      <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6 text-amber-800 font-medium">
                        Noch keine Analyse durchgeführt. (Gehe zu ② Bewerbungen)
                      </div>
                    )}
                    
                    {isAnalyzing && (
                      <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-6 text-blue-800 font-bold flex items-center gap-3 animate-pulse">
                        <span className="animate-spin text-xl">⏳</span> Die Agenten arbeiten im Hintergrund...
                      </div>
                    )}
                    
                    {analysisResult && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {analysisResult.candidate_results.map((res: any, i: number) => (
                          <Card key={i} className="bg-white/80 backdrop-blur border-slate-200/60 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all rounded-2xl flex flex-col">
                            <CardContent className="p-6 flex-1 flex flex-col">
                              <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-lg text-slate-900 truncate max-w-[70%]">{res.filename}</h3>
                                <Badge className={cn("px-2 py-0.5 rounded-md shadow-none font-bold", res.decision.is_match ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-red-100 text-red-800 hover:bg-red-100")}>
                                  {res.decision.is_match ? 'Match' : 'Kein Match'}
                                </Badge>
                              </div>
                              <p className="text-slate-600 text-sm leading-relaxed mb-6 flex-1 line-clamp-4">
                                {res.decision.reasoning}
                              </p>
                              
                              <Button 
                                variant="outline" 
                                onClick={() => setSelectedCandidateId(res.filename)} 
                                className="w-full mt-auto rounded-xl border-slate-200 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold flex items-center justify-center gap-1"
                              >
                                Profil ansehen <ChevronRight size={16} />
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4 */}
                {activeTab === 4 && (
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">Informationslücken</h2>
                      <p className="text-slate-600">Fehlende Informationen aus den Lebensläufen, die für das Matching relevant sind.</p>
                    </div>
                    
                    {!analysisResult && (
                      <div className="bg-slate-100/50 border border-slate-200 rounded-2xl p-6 text-slate-500 font-medium text-center">
                        Noch keine Analyse durchgeführt.
                      </div>
                    )}
                    
                    {analysisResult && (
                      <div className="flex flex-col gap-6">
                        {analysisResult.candidate_results.map((res: any, i: number) => {
                          const gaps = res.gaps || [];
                          if (gaps.length === 0) return null;
                          
                          return (
                            <Card key={i} className="bg-white shadow-sm border-slate-200/60 rounded-2xl overflow-hidden">
                              <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center gap-2">
                                <span className="text-xl">👤</span>
                                <h3 className="font-bold text-slate-900">{res.filename}</h3>
                              </div>
                              <CardContent className="p-6">
                                <ul className="space-y-4">
                                  {gaps.map((g: any, j: number) => (
                                    <li key={j} className="flex gap-3">
                                      <span className="text-amber-500 mt-1 font-black">•</span>
                                      <div>
                                        <div className="font-bold text-slate-900">{g.requirement}</div>
                                        <div className="text-slate-600 text-sm mt-1">{g.description}</div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </CardContent>
                            </Card>
                          );
                        })}
                        {analysisResult.candidate_results.every((r: any) => !r.gaps || r.gaps.length === 0) && (
                          <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-6 text-emerald-800 font-bold text-center">
                            🎉 Keine Informationslücken gefunden!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 5 */}
                {activeTab === 5 && (
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">Rückfragen & E-Mails</h2>
                      <p className="text-slate-600">Vorgeschlagene Fragen und automatisch generierte E-Mail-Entwürfe.</p>
                    </div>

                    {!analysisResult && (
                      <div className="bg-slate-100/50 border border-slate-200 rounded-2xl p-6 text-slate-500 font-medium text-center">
                        Noch keine Analyse durchgeführt.
                      </div>
                    )}

                    {analysisResult && (
                      <div className="flex flex-col gap-8">
                        {analysisResult.candidate_results.map((res: any, i: number) => (
                          <Card key={i} className="bg-white shadow-md border-slate-200/60 rounded-2xl overflow-hidden">
                            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center gap-2">
                              <span className="text-xl">👤</span>
                              <h3 className="font-bold text-slate-900 text-lg">{res.filename}</h3>
                            </div>
                            
                            <CardContent className="p-6">
                              {(res.questions && res.questions.length > 0) && (
                                <div className="mb-8">
                                  <h4 className="font-bold text-indigo-700 uppercase tracking-wider text-xs mb-3">Vorgeschlagene Fragen</h4>
                                  <ul className="space-y-2">
                                    {res.questions.map((q: string, j: number) => (
                                      <li key={j} className="flex gap-2 text-slate-700 font-medium">
                                        <span className="text-indigo-400 font-bold">•</span>
                                        {q}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {res.email_draft && (
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                                  <h4 className="flex items-center gap-2 font-bold text-slate-900 mb-4">
                                    <Mail className="text-slate-400" size={18} /> Entwurf (Vorschau)
                                  </h4>
                                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600 leading-relaxed mb-6 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                    {res.email_draft}
                                  </pre>
                                  
                                  <Button 
                                    asChild
                                    className="rounded-xl shadow-md bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                                  >
                                    <a href={`mailto:?subject=Rückfrage zu Ihrer Bewerbung&body=${encodeURIComponent(res.email_draft)}`}>
                                      📧 In E-Mail-Programm öffnen
                                    </a>
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 6 */}
                {activeTab === 6 && <AuditLog />}
              </TabContent>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <CandidateDetail />
    </>
  );
};
