import React from 'react';
import { useSessionStore } from '../store/session';

export const AuditLog: React.FC = () => {
  const { auditLog, clearAuditLog } = useSessionStore();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div className="section" style={{ margin: 0 }}>
          <h2 style={{ margin: 0 }}>Audit Log</h2>
          <p className="lead" style={{ margin: '8px 0 0 0' }}>Jeder Verarbeitungsschritt wird lückenlos dokumentiert.</p>
        </div>
        {auditLog.length > 0 && (
          <button 
            onClick={clearAuditLog}
            className="navbtn"
            style={{
              background: 'rgba(255,255,255,.7)',
              border: '1px solid rgba(124,92,255,.18)',
              padding: '8px 16px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              color: 'var(--rai-ink)'
            }}
          >
            🗑️ Audit Log leeren
          </button>
        )}
      </div>

      {!auditLog || auditLog.length === 0 ? (
        <div className="hitl" style={{ textAlign: 'center' }}>
          Noch keine Aktivität protokolliert.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...auditLog].reverse().map((entry, idx) => (
            <div key={idx} className="cand" style={{ margin: 0, padding: '16px 20px' }}>
              <div style={{ fontSize: '1.05rem', color: 'var(--rai-ink)' }}>
                <span className="meta">{entry.timestamp}</span> &middot;{' '}
                <b style={{ color: 'var(--rai-purple)' }}>{entry.agent}</b> &mdash; {entry.action}
              </div>
              <div className="meta" style={{ marginTop: '8px' }}>
                {entry.detail}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
