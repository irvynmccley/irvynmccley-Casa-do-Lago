import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress specific Supabase auth errors from bubbling up to error overlays
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason) || '';
  if (msg.includes('Refresh Token') || msg.includes('refresh_token') || (msg.includes('not found') && msg.includes('Token')) || msg.includes('Invalid Refresh Token')) {
    event.preventDefault();
    console.warn('Suppressed unhandled refresh token error:', event.reason);
    
    // Also clear local storage just in case
    try {
      let cleared = false;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
          cleared = true;
        }
      }
      if (cleared) {
        window.location.reload();
      }
    } catch (e) {}
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
