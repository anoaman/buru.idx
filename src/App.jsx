import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import AnalysisShell from './components/AnalysisShell.jsx';
import { AnalysisProvider } from './components/AnalysisContext.jsx';
import BrokerIntelligence from './features/broker-intelligence/BrokerIntelligence.jsx';
import Keterbukaan from './features/keterbukaan/Keterbukaan.jsx';
import Workbench from './features/workbench/Workbench.jsx';
import Radar from './features/radar/Radar.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AnalysisProvider>
        <AnalysisShell>
          <Routes>
            <Route path="/" element={<Navigate to="/workbench" replace />} />
            <Route path="/radar" element={<Radar />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/broker-intelligence" element={<BrokerIntelligence />} />
            <Route path="/keterbukaan" element={<Keterbukaan />} />
            <Route path="*" element={<Navigate to="/workbench" replace />} />
          </Routes>
        </AnalysisShell>
      </AnalysisProvider>
    </BrowserRouter>
  );
}
