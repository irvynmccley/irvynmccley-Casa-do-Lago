import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress specific Supabase auth errors from bubbling up to error overlays
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (msg.includes('Refresh Token') || msg.includes('refresh_token') || (msg.includes('not found') && msg.includes('Token'))) {
    event.preventDefault();
    console.warn('Suppressed unhandled refresh token error:', event.reason);
    
    // Also clear local storage just in case
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
