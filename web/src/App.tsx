import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NavBar } from './components/NavBar';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Workspace = lazy(() =>
  import('./pages/workspace/Workspace').then((m) => ({ default: m.Workspace })),
);

function App() {
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
