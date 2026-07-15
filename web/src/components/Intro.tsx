import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/session';
import { SplineScene } from './SplineScene';
import { ChevronDown } from 'lucide-react';

export const Intro: React.FC = () => {
  const { hasSeenIntro, setHasSeenIntro } = useSessionStore();
  const [isLifting, setIsLifting] = useState(false);

  // If already seen, we just don't render it at all.
  if (hasSeenIntro) return null;

  const handleLift = () => {
    setIsLifting(true);
    setTimeout(() => {
      setHasSeenIntro(true);
    }, 850); // wait for CSS transition
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
        background: 'radial-gradient(circle at center, #1a1528 0%, #09080d 100%)',
        zIndex: 9999,
      }}
    >
      {/* 
        Spline scene fills the background.
        Because it contains an interactive element, we place an absolute overlay
        (catcher) on top of it so the user can click anywhere to lift the hero.
      */}
      <SplineScene />
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
          color: '#d1cbf5',
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
        <span>SCROLL TO EXPLORE</span>
        <div style={{
          width: '18px',
          height: '18px',
          borderRight: '2px solid #d1cbf5',
          borderBottom: '2px solid #d1cbf5',
          transform: 'rotate(45deg)',
          animation: 'bob 1.8s infinite ease-in-out'
        }} />
      </div>
    </div>
  );
};
