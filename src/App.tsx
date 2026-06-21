import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { Dashboard } from './pages/Dashboard';
import { ChatPage } from './pages/ChatPage';
import { Settings } from './pages/Settings';
import { Overlay } from './pages/Overlay';
import { useAppStore } from './store';

function AppLayout() {
  const location = useLocation();
  const isOverlay = location.pathname === '/overlay';
  const settings = useAppStore((s) => s.settings);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const inTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__?.ipc && !(window as any).__TAURI_INTERNALS__?.isMock;
    if (inTauri) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('broadcast_settings', { settings }).catch((e) =>
          console.error('Failed to broadcast settings:', e)
        );
      });
    }
  }, [settings]);

  // Overlay route renders without chrome
  if (isOverlay) {
    return <Overlay />;
  }

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar onCollapse={() => setSidebarCollapsed(true)} />
      <div className="app-main">
        {sidebarCollapsed && (
          <button
            className="sidebar-expand-btn"
            onClick={() => setSidebarCollapsed(false)}
            title="Expand Sidebar"
          >
            ☰
          </button>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <StatusBar />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </HashRouter>
  );
}
