import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { ensureSeeded } from './db/db';

registerSW({ immediate: true });

async function boot() {
  try {
    // Ask Safari not to evict IndexedDB under storage pressure.
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not available */
  }
  await ensureSeeded();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();
