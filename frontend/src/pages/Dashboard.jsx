import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Layout from '../components/Layout';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user } = useAuth();

  // Admin quick stats
  const [stats, setStats] = useState({ sections: 0, faculty: 0, rooms: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') return;
    setStatsLoading(true);
    Promise.all([
      api.get('/sections'),
      api.get('/faculty'),
      api.get('/rooms'),
    ])
      .then(([secRes, facRes, roomRes]) => {
        setStats({
          sections: secRes.data?.data?.length ?? secRes.data?.length ?? 0,
          faculty:  facRes.data?.data?.length  ?? facRes.data?.length  ?? 0,
          rooms:    roomRes.data?.data?.length  ?? roomRes.data?.length  ?? 0,
        });
      })
      .catch(() => setStatsError('Could not load quick stats.'))
      .finally(() => setStatsLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <Layout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.welcomeText}>
              Welcome back, <span className={styles.name}>{user.name}</span> 👋
            </h1>
            <p className={styles.subtitle}>Here's your Classly overview</p>
          </div>
          <span className={`${styles.rolePill} ${styles[`role_${user.role}`]}`}>
            {user.role}
          </span>
        </div>

      {/* Admin view */}
      {user.role === 'admin' && (
        <>
          {/* Quick stats */}
          <div className={styles.statsRow}>
            {statsLoading ? (
              <div className={styles.statsLoading}>
                <span className={styles.spinner} /> Loading stats…
              </div>
            ) : statsError ? (
              <p className={styles.statsError}>{statsError}</p>
            ) : (
              <>
                <StatCard label="Sections" value={stats.sections} icon="📚" />
                <StatCard label="Faculty"  value={stats.faculty}  icon="👨‍🏫" />
                <StatCard label="Rooms"    value={stats.rooms}    icon="🏫" />
              </>
            )}
          </div>

          {/* Action cards */}
          <div className={styles.cardsGrid}>
            <DashCard
              to="/admin"
              icon="⚙️"
              title="Admin Panel"
              desc="Manage faculty, rooms, subjects, sections and generate timetables"
              accent
            />
            <DashCard
              to="/admin/timetable"
              icon="📅"
              title="View Timetable"
              desc="Live real-time view of any section's timetable — updates instantly"
            />
            <DashCard
              to="/analytics"
              icon="📊"
              title="Analytics"
              desc="View faculty workload and room utilization charts"
            />
          </div>
        </>
      )}

      {/* Faculty view */}
      {user.role === 'faculty' && (
        <div className={styles.cardsGrid}>
          <DashCard
            to="/faculty"
            icon="📋"
            title="My Timetable"
            desc="View your scheduled lectures and manage slot availability"
            accent
          />
        </div>
      )}

      {/* Student view */}
      {user.role === 'student' && (
        <div className={styles.cardsGrid}>
          <DashCard
            to="/student"
            icon="🗓️"
            title="View Timetable"
            desc="See your section's timetable and get real-time updates"
            accent
          />
        </div>
      )}
      </div>
    </Layout>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

function StatCard({ label, value, icon }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statIcon}>{icon}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function DashCard({ to, icon, title, desc, accent }) {
  return (
    <Link to={to} className={`${styles.card} ${accent ? styles.cardAccent : ''}`}>
      <span className={styles.cardIcon}>{icon}</span>
      <h2 className={styles.cardTitle}>{title}</h2>
      <p className={styles.cardDesc}>{desc}</p>
      <span className={styles.cardArrow}>→</span>
    </Link>
  );
}
