import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import AnalysisShell from './components/AnalysisShell.jsx';
import { AnalysisProvider } from './components/AnalysisContext.jsx';
import BrokerIntelligence from './features/broker-intelligence/BrokerIntelligence.jsx';
import Workbench from './features/workbench/Workbench.jsx';
import Radar from './features/radar/Radar.jsx';
import Cases from './features/cases/Cases.jsx';
import Fundamentals from './features/fundamentals/Fundamentals.jsx';
import Glossary from './features/glossary/Glossary.jsx';
import { privateWritesEnabled } from './lib/api/client.js';

export default function App() {
  return (
    <BrowserRouter>
      <AnalysisProvider>
        <AnalysisShell>
          <Routes>
            <Route path="/" element={<Navigate to="/workbench" replace />} />
            <Route path="/radar" element={<Radar />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/fundamentals" element={<Fundamentals />} />
            <Route path="/broker-intelligence" element={<BrokerIntelligence />} />
            {privateWritesEnabled && <Route path="/cases" element={<Cases />} />}
            <Route path="/glossary" element={<Glossary />} />
            <Route path="*" element={<Navigate to="/workbench" replace />} />
          </Routes>
        </AnalysisShell>
      </AnalysisProvider>
    </BrowserRouter>
  );
}
