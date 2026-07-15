import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/session';

export const Intro: React.FC = () => {
  const { hasSeenIntro, setHasSeenIntro } = useSessionStore();
  const [isLifting, setIsLifting] = useState(false);

  useEffect(() => {
    // Load spline-viewer script dynamically
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@splinetool/viewer@1.9.48/build/spline-viewer.js';
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  if (hasSeenIntro) return null;

  const handleLift = () => {
    setIsLifting(true);
    setTimeout(() => {
      setHasSeenIntro(true);
    }, 850);
  };

  return (
    <div
      className={`hero ${isLifting ? 'lift' : ''}`}
      onClick={handleLift}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform .85s cubic-bezier(.76,0,.24,1), opacity .85s ease',
        background: 'linear-gradient(180deg,#fbfbff 0%, #f1f2fb 100%)',
        zIndex: 9999,
      }}
    >
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '100vw',
        height: '100vh',
        transform: 'translate(-43%,-50%) scale(1.7)',
        transformOrigin: 'center center'
      }}>
        {/* @ts-ignore */}
        <spline-viewer url="https://prod.spline.design/Ji0hiX2hb-mU5zX1/scene.splinecode" events-target="global"></spline-viewer>
      </div>

      <div
        className="catcher"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          background: 'transparent',
        }}
      />
      
      <div
        className="scroll"
        style={{
          position: 'absolute',
          bottom: '6vh',
          left: 0,
          right: 0,
          margin: '0 auto',
          width: 'max-content',
          color: '#6b5bd0',
          fontSize: '.76rem',
          letterSpacing: '.2em',
          textTransform: 'uppercase',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          animation: 'fadeUp 1.1s ease both .4s',
          zIndex: 4,
          pointerEvents: 'none',
        }}
      >
        <span>Scroll to Explore</span>
        <div style={{
          width: '18px',
          height: '18px',
          borderRight: '2px solid #6b5bd0',
          borderBottom: '2px solid #6b5bd0',
          transform: 'rotate(45deg)',
          animation: 'bob 1.8s infinite ease-in-out'
        }} />
      </div>
    </div>
  );
};
