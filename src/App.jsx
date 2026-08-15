import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import AnalysisShell from './components/AnalysisShell.jsx';
import { AnalysisProvider } from './components/AnalysisContext.jsx';
import BrokerIntelligence from './features/broker-intelligence/BrokerIntelligence.jsx';
import Fundamentals from './features/fundamentals/Fundamentals.jsx';
import NewsDetector from './features/news-detector/NewsDetector.jsx';
import Glossary from './features/glossary/Glossary.jsx';
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
            <Route path="/fundamentals" element={<Fundamentals />} />
            <Route path="/news-detector" element={<NewsDetector />} />
            <Route path="/keterbukaan" element={<Navigate to="/news-detector" replace />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="*" element={<Navigate to="/workbench" replace />} />
          </Routes>
        </AnalysisShell>
      </AnalysisProvider>
    </BrowserRouter>
  );
}
