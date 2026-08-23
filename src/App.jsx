import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import AnalysisShell from './components/AnalysisShell.jsx';
import { AnalysisProvider } from './components/AnalysisContext.jsx';

const BrokerIntelligence = lazy(() => import('./features/broker-intelligence/BrokerIntelligence.jsx'));
const Fundamentals = lazy(() => import('./features/fundamentals/Fundamentals.jsx'));
const NewsDetector = lazy(() => import('./features/news-detector/NewsDetector.jsx'));
const Glossary = lazy(() => import('./features/glossary/Glossary.jsx'));
const Workbench = lazy(() => import('./features/workbench/Workbench.jsx'));
const Radar = lazy(() => import('./features/radar/Radar.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <AnalysisProvider>
        <AnalysisShell>
          <Suspense fallback={<div className="panel" role="status">Loading analysis…</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/workbench" replace />} />
              <Route path="/radar" element={<Radar />} />
              <Route path="/workbench" element={<Workbench />} />
              <Route path="/broker-intelligence" element={<BrokerIntelligence />} />
              <Route path="/fundamentals" element={<Fundamentals />} />
              <Route path="/news-detector" element={<NewsDetector />} />
              <Route path="/keterbukaan" element={<Navigate to="/news-detector" replace />} />
              <Route path="/glossary" element={<Glossary />} />
              <Route path="*" element={<Navigate to="/workbench" replace />} />
            </Routes>
          </Suspense>
        </AnalysisShell>
      </AnalysisProvider>
    </BrowserRouter>
  );
}
