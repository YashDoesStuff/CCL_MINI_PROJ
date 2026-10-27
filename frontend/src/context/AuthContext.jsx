import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);        // { id, name, role, facultyProfileId? }
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app load — restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    if (storedToken) {
      try {
        const decoded = jwtDecode(storedToken);
        if (decoded.exp * 1000 > Date.now()) {
          const name             = localStorage.getItem('userName') || 'User';
          const facultyProfileId = localStorage.getItem('facultyProfileId') || null;
          setUser({ id: decoded.id, name, role: decoded.role, facultyProfileId });
          setAccessToken(storedToken);
        } else {
          localStorage.clear();
        }
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken: token, refreshToken, user: userFromServer } = res.data.data;

    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userName', userFromServer.name);
    if (userFromServer.facultyProfileId) {
      localStorage.setItem('facultyProfileId', userFromServer.facultyProfileId);
    } else {
      localStorage.removeItem('facultyProfileId');
    }

    const decoded = jwtDecode(token);
    const userData = {
      id: decoded.id,
      name: userFromServer.name,
      role: decoded.role,
      facultyProfileId: userFromServer.facultyProfileId || null,
    };

    setAccessToken(token);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout API errors
    }
    localStorage.clear();
    setUser(null);
    setAccessToken(null);
  }, []);

  const register = useCallback(async (name, email, password, role) => {
    const res = await api.post('/auth/register', { name, email, password, role });
    const { accessToken: token, refreshToken, user: userFromServer } = res.data.data;

    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('userName', userFromServer.name);
    if (userFromServer.facultyProfileId) {
      localStorage.setItem('facultyProfileId', userFromServer.facultyProfileId);
    } else {
      localStorage.removeItem('facultyProfileId');
    }

    const decoded = jwtDecode(token);
    const userData = {
      id: decoded.id,
      name: userFromServer.name,
      role: decoded.role,
      facultyProfileId: userFromServer.facultyProfileId || null,
    };

    setAccessToken(token);
    setUser(userData);
    return userData;
  }, []);

  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

