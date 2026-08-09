import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import PublicShell from './components/PublicShell.jsx';
import BrokerIntelligence from './features/broker-intelligence/BrokerIntelligence.jsx';
import Workbench from './features/workbench/Workbench.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <PublicShell>
        <Routes>
          <Route path="/" element={<Navigate to="/workbench" replace />} />
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/broker-intelligence" element={<BrokerIntelligence />} />
          <Route path="*" element={<Navigate to="/workbench" replace />} />
        </Routes>
      </PublicShell>
    </BrowserRouter>
  );
}
