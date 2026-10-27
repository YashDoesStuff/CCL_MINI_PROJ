import { useState, useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import styles from './Layout.module.css';

const ROLE_LINKS = {
  admin: [
    { to: '/dashboard',        label: 'Dashboard',       end: true },
    { to: '/admin',            label: 'Admin Panel',     end: true },
    { to: '/admin/timetable',  label: 'View Timetable',  end: true },
    { to: '/analytics',        label: 'Analytics',       end: true },
  ],
  faculty: [
    { to: '/dashboard', label: 'Dashboard',    end: true },
    { to: '/faculty',   label: 'My Timetable', end: true },
  ],
  student: [
    { to: '/dashboard', label: 'Dashboard',     end: true },
    { to: '/student',   label: 'View Timetable', end: true },
  ],
};

export default function Layout({ children, headerActions, rightPanel }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const links = user ? ROLE_LINKS[user.role] : [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className={styles.layout}>
      {/* ── Top Bar ── */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <button className={styles.hamburger} onClick={toggleSidebar}>
            ☰
          </button>
          <span className={styles.appName}>Classly</span>
        </div>

        <div className={styles.topActions}>
          {headerActions}
        </div>

        <div className={styles.topRight}>
          <div className={styles.profileBtn} onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className={styles.profileAvatar}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className={styles.profileName}>{user?.name}</span>
            {profileMenuOpen && (
              <div className={styles.profileMenu}>
                <div className={styles.menuHeader}>
                  <strong>{user?.name}</strong>
                  <span className={styles.menuRole}>{user?.role}</span>
                </div>
                <button className={styles.logoutBtn} onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <div className={styles.mainWrapper}>
        
        {/* ── Left Sidebar ── */}
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <nav className={styles.navLinks}>
            {links?.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* ── Overlay for mobile sidebar ── */}
        {sidebarOpen && (
          <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Center Content ── */}
        <main className={styles.centerArea}>
          {children}
        </main>

        {/* ── Right Panel (Optional) ── */}
        {rightPanel && (
          <aside className={styles.rightPanel}>
            {rightPanel}
          </aside>
        )}
      </div>
    </div>
  );
}
