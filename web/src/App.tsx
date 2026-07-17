import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NavBar } from './components/NavBar';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Workspace = lazy(() =>
  import('./pages/workspace/Workspace').then((m) => ({ default: m.Workspace })),
);

function App() {
  const { t } = useTranslation();
  const [hasAccess, setHasAccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pwdFromUrl = params.get('pwd');
    if (pwdFromUrl) {
      localStorage.setItem('pwd', pwdFromUrl);
      // Optional: remove pwd from URL to keep it clean
      const url = new URL(window.location.href);
      url.searchParams.delete('pwd');
      window.history.replaceState({}, '', url);
    }

    const currentPwd = localStorage.getItem('pwd');
    if (!currentPwd) {
      setIsVerifying(false);
      return;
    }

    fetch('/api/verify', {
      headers: { 'X-Access-Token': currentPwd }
    })
      .then((res) => {
        if (res.ok) {
          setHasAccess(true);
        } else {
          localStorage.removeItem('pwd');
        }
      })
      .catch(() => {
        localStorage.removeItem('pwd');
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, []);

  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-slate-500 font-medium animate-pulse">{t('access.verifying')}</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <h1 className="text-3xl font-black text-slate-900 mb-4">{t('access.deniedTitle')}</h1>
        <p className="text-lg text-slate-600 mb-8 max-w-md">{t('access.deniedDesc')}</p>
      </div>
    );
  }

  return (
    <div>
      <BrowserRouter>
        <NavBar />
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/workspace" element={<Workspace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </div>
  );
}

export default App;
