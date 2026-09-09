import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import AnalysisShell from './components/AnalysisShell.jsx';
import { AnalysisProvider } from './components/AnalysisContext.jsx';

const BrokerIntelligence = lazy(() => import('./features/broker-intelligence/BrokerIntelligence.jsx'));
const Glossary = lazy(() => import('./features/glossary/Glossary.jsx'));
const Workbench = lazy(() => import('./features/workbench/Workbench.jsx'));
const Radar = lazy(() => import('./features/radar/Radar.jsx'));
const Monitored = lazy(() => import('./features/cases/Cases.jsx'));

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
              <Route path="/monitored" element={<Monitored />} />
              <Route path="/cases" element={<Navigate to="/monitored" replace />} />
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
