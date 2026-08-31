import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Auto-updates the installed PWA in the background; notifies App.tsx via a
// CustomEvent so the existing toast system (App.tsx) can surface it, since
// this registration runs outside the React tree.
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('village-azaleia:pwa-update-ready'));
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
