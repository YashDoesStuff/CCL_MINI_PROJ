import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 * Props:
 *   children     — component to render
 *   allowedRoles — string[] of roles that may access this route
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user, loading } = useAuth();

  // Wait for localStorage restore before deciding
  if (loading) return null;

  // Not logged in → go to login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Logged in but wrong role → go to dashboard
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
