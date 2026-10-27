import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Register.module.css';

export default function Register() {
  const { register, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('faculty');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill out all fields.');
      return;
    }

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password, role);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Left Form Area */}
        <div className={styles.formArea}>
          <div className={styles.logoArea}>
            <h1 className={styles.appName}>Classly</h1>
            <p className={styles.tagline}>Create your account</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="register-name" className={styles.label}>Full Name</label>
              <input
                id="register-name"
                type="text"
                className={styles.input}
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="register-email" className={styles.label}>Email</label>
              <input
                id="register-email"
                type="email"
                className={styles.input}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="register-password" className={styles.label}>Password</label>
              <input
                id="register-password"
                type="password"
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Select Role</label>
              <div className={styles.roleSelector}>
                <label className={`${styles.roleOption} ${role === 'faculty' ? styles.roleActive : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="faculty"
                    checked={role === 'faculty'}
                    onChange={(e) => setRole(e.target.value)}
                  />
                  <span>Faculty</span>
                </label>
                <label className={`${styles.roleOption} ${role === 'student' ? styles.roleActive : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={role === 'student'}
                    onChange={(e) => setRole(e.target.value)}
                  />
                  <span>Student</span>
                </label>
                <label className={`${styles.roleOption} ${role === 'admin' ? styles.roleActive : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={role === 'admin'}
                    onChange={(e) => setRole(e.target.value)}
                  />
                  <span>Admin</span>
                </label>
              </div>
            </div>

            {error && (
              <div className={styles.errorBox} role="alert">
                {error}
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <p className={styles.footer}>
            Already have an account? <Link to="/login" className={styles.link}>Log in</Link>
          </p>
        </div>

        {/* Right Illustration Area */}
        <div className={styles.illustrationArea}>
          <div className={styles.illustrationContent}>
            {role === 'faculty' && (
              <div className={styles.illustrationBox}>
                <div className={styles.iconLarge}>👩‍🏫</div>
                <h2>Teacher Dashboard</h2>
                <p>Manage your timetable, claim slots, and view your schedule dynamically.</p>
              </div>
            )}
            {role === 'student' && (
              <div className={styles.illustrationBox}>
                <div className={styles.iconLarge}>🎓</div>
                <h2>Student Portal</h2>
                <p>View your class schedule, check live updates, and stay informed.</p>
              </div>
            )}
            {role === 'admin' && (
              <div className={styles.illustrationBox}>
                <div className={styles.iconLarge}>⚙️</div>
                <h2>Admin Control</h2>
                <p>Generate timetables, manage faculty, and oversee the entire system.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
