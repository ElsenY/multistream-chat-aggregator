import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { Dashboard } from './pages/Dashboard';
import { ChatPage } from './pages/ChatPage';
import { Settings } from './pages/Settings';
import { Overlay } from './pages/Overlay';

function AppLayout() {
  const location = useLocation();
  const isOverlay = location.pathname === '/overlay';

  // Overlay route renders without chrome
  if (isOverlay) {
    return <Overlay />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
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
