if (typeof window !== 'undefined' && !(window as any).__TAURI_INTERNALS__) {
  (window as any).__TAURI_INTERNALS__ = {};
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
