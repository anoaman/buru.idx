import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import AnalysisShell from './components/AnalysisShell.jsx';
import { AnalysisProvider } from './components/AnalysisContext.jsx';
import { startAnalytics, trackPageView } from './lib/analytics.js';

const BrokerIntelligence = lazy(() => import('./features/broker-intelligence/BrokerIntelligence.jsx'));
const Glossary = lazy(() => import('./features/glossary/Glossary.jsx'));
const Workbench = lazy(() => import('./features/workbench/Workbench.jsx'));
const Radar = lazy(() => import('./features/radar/Radar.jsx'));
const Home = lazy(() => import('./features/home/Home.jsx'));

function PageViews() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    startAnalytics();
  }, []);
  useEffect(() => {
    trackPageView(pathname, search);
  }, [pathname, search]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <PageViews />
      <AnalysisProvider>
        <AnalysisShell>
          <Suspense fallback={<div className="panel" role="status">Loading analysis…</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/radar" element={<Radar />} />
              <Route path="/workbench" element={<Workbench />} />
              <Route path="/broker-intelligence" element={<BrokerIntelligence />} />
              <Route path="/fundamentals" element={<Navigate to="/workbench" replace />} />
              <Route path="/news-detector" element={<Navigate to="/workbench" replace />} />
              <Route path="/keterbukaan" element={<Navigate to="/workbench" replace />} />
              <Route path="/glossary" element={<Glossary />} />
              <Route path="*" element={<Navigate to="/workbench" replace />} />
            </Routes>
          </Suspense>
        </AnalysisShell>
      </AnalysisProvider>
    </BrowserRouter>
  );
}
