import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = String(event.reason?.message || event.reason || '');
  if (
    reasonStr.includes('WebSocket') ||
    reasonStr.includes('vite') ||
    reasonStr.includes('closed without opened') ||
    reasonStr.includes('Unexpected token') ||
    reasonStr.includes('is not valid JSON') ||
    reasonStr.includes('JSON.parse')
  ) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const errStr = String(event.message || event.error || '');
  if (
    errStr.includes('WebSocket') ||
    errStr.includes('vite') ||
    errStr.includes('closed without opened') ||
    errStr.includes('Unexpected token') ||
    errStr.includes('is not valid JSON') ||
    errStr.includes('JSON.parse')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
