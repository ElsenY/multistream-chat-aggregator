import { NavLink } from 'react-router-dom';
import { useAppStore } from '../store';

interface SidebarProps {
  onCollapse: () => void;
}

export function Sidebar({ onCollapse }: SidebarProps) {
  const twitch = useAppStore((s) => s.twitch);
  const youtube = useAppStore((s) => s.youtube);
  const messages = useAppStore((s) => s.messages);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">💬</div>
          <span className="sidebar-logo-text">Stream Chat</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `sidebar-nav-link ${isActive ? 'active' : ''}`
          }
        >
          <span className="sidebar-nav-icon">📡</span>
          Dashboard
        </NavLink>

        <NavLink
          to="/chat"
          className={({ isActive }) =>
            `sidebar-nav-link ${isActive ? 'active' : ''}`
          }
        >
          <span className="sidebar-nav-icon">💭</span>
          Chat
          {messages.length > 0 && (
            <span className="sidebar-badge">{messages.length}</span>
          )}
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `sidebar-nav-link ${isActive ? 'active' : ''}`
          }
        >
          <span className="sidebar-nav-icon">⚙️</span>
          Settings
        </NavLink>

        <NavLink
          to="/overlay"
          className={({ isActive }) =>
            `sidebar-nav-link ${isActive ? 'active' : ''}`
          }
        >
          <span className="sidebar-nav-icon">🖥️</span>
          OBS Overlay
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-collapse-btn" onClick={onCollapse} title="Hide Sidebar">
          ◀ Hide Sidebar
        </button>
        <div className="sidebar-connections">
          <div className="sidebar-connection">
            <span
              className={`connection-dot ${
                twitch.status === 'connected'
                  ? 'online'
                  : twitch.status === 'connecting'
                  ? 'connecting'
                  : 'offline'
              }`}
            />
            <span>Twitch {twitch.channel ? `(${twitch.channel})` : ''}</span>
          </div>
          <div className="sidebar-connection">
            <span
              className={`connection-dot ${
                youtube.status === 'connected'
                  ? 'online'
                  : youtube.status === 'connecting'
                  ? 'connecting'
                  : 'offline'
              }`}
            />
            <span>YouTube</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
