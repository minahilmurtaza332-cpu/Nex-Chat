import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = String(event.reason?.message || event.reason || '');
  if (
    reasonStr.includes('WebSocket') ||
    reasonStr.includes('vite') ||
    reasonStr.includes('closed without opened')
  ) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const errStr = String(event.message || event.error || '');
  if (
    errStr.includes('WebSocket') ||
    errStr.includes('vite') ||
    errStr.includes('closed without opened')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
