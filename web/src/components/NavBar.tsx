import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

const _HF = "https://d8j0ntlcm91z4.cloudfront.net/user_33IJIDZ0cOmwdzXkCP5nbQryjVC/";
const LOGO_URL = _HF + "hf_20260621_113356_37574f61-266d-4c83-a8e0-bdd07a191331.png";

export const NavBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <div className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-6xl z-50 transition-all duration-300",
        "flex items-center justify-between px-6 py-3 rounded-2xl border bg-white/40 backdrop-blur-xl shadow-lg",
        scrolled ? "bg-white/70 shadow-xl border-white/60" : "border-white/40"
      )}>
        {/* Brand */}
        <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img src={LOGO_URL} alt="Recruiting AI" className="w-8 h-8 rounded-lg object-contain shadow-sm" />
          <span className="font-extrabold text-lg text-slate-900 tracking-tight">Recruiting AI</span>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/50 px-2.5 py-1 rounded-full uppercase tracking-wider hidden sm:inline-block">
            Multi-Agent HR
          </span>
        </div>

        {/* Spacer / Links */}
        <div className="flex-2 flex justify-center">
          {isHome && (
            <div className="hidden md:flex items-center gap-1">
              <a href="#problem" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">Das Problem</a>
              <a href="#loesung" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">Die Lösung</a>
              <a href="#schritte" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">Schritte</a>
              <a href="#preise" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">Preise</a>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex-1 flex justify-end">
          {isHome ? (
            <Button onClick={() => navigate('/workspace')} className="rounded-xl shadow-md bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-semibold border-0">
              Workspace öffnen &rarr;
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate('/')} className="rounded-xl font-semibold bg-white/60 backdrop-blur-sm border-slate-200">
              &larr; Startseite
            </Button>
          )}
        </div>
      </div>
      
      {!isHome && <div className="h-24"></div>}
    </>
  );
};
