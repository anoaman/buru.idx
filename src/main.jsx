import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/components.css';
import App from './App.jsx';
import { importHandoff } from './lib/handoff.js';
import { startAnalytics } from './lib/analytics.js';

importHandoff();
startAnalytics();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
