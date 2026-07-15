import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const _HF = "https://d8j0ntlcm91z4.cloudfront.net/user_33IJIDZ0cOmwdzXkCP5nbQryjVC/";
const LOGO_URL = _HF + "hf_20260621_113356_37574f61-266d-4c83-a8e0-bdd07a191331.png";

export const NavBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  return (
    <>
      <div data-testid="stHorizontalBlock" style={{ position: 'fixed', top: '14px', left: '50%', transform: 'translateX(-50%)', width: 'min(1180px, calc(100vw - 40px))', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* This triggers the styling in index.css */}
        <span className="navbar-mark"></span>

        {/* Brand */}
        <div data-testid="column" style={{ flex: 2.4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800, fontSize: '1.15rem', color: '#0f1226', transform: 'translateY(-2px)' }}>
            <img src={LOGO_URL} alt="Recruiting AI" style={{ width: '32px', height: '32px', borderRadius: '9px', objectFit: 'contain' }} />
            Recruiting&nbsp;AI
            <span style={{ fontSize: '.72rem', fontWeight: 600, color: '#7c5cff', background: 'rgba(124,92,255,.10)', padding: '3px 9px', borderRadius: '999px', marginLeft: '6px' }}>
              Multi-Agent HR
            </span>
          </div>
        </div>

        {/* Spacer / Links */}
        <div data-testid="column" style={{ flex: 3.2, display: 'flex', justifyContent: 'center' }}>
          {isHome && (
            <div className="navlinks">
              <a href="#problem">Das Problem</a>
              <a href="#loesung">Die Lösung</a>
              <a href="#schritte">Schritte</a>
              <a href="#preise">Preise</a>
            </div>
          )}
        </div>

        {/* CTA */}
        <div data-testid="column" style={{ flex: 1.7, display: 'flex', justifyContent: 'flex-end' }}>
          {isHome ? (
            <div className="stButton">
              <button kind="primary" onClick={() => navigate('/workspace')} style={{ width: '100%' }}>
                Workspace öffnen →
              </button>
            </div>
          ) : (
            <div className="stButton">
              <button onClick={() => navigate('/')} style={{ width: '100%' }}>
                ← Startseite
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Spacer so content starts below the floating bar on pages other than home */}
      {!isHome && <div style={{ height: '84px' }}></div>}
    </>
  );
};
