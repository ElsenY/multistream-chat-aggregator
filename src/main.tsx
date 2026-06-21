if (typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__) {
  (window as any).__TAURI_INTERNALS__ = {
    ipc: () => Promise.resolve(),
    transformCallback: () => 'dummy-callback-id',
    isMock: true,
  };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
