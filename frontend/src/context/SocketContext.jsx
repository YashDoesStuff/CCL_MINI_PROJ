import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, accessToken, isAuthenticated } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);

  // Connect socket when user logs in
  useEffect(() => {
    if (!isAuthenticated || !accessToken || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    // VITE_SOCKET_URL must be defined in frontend/.env
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

    const newSocket = io(socketUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      // Join appropriate rooms based on role
      // sectionId is null initially — FacultyView/StudentView will re-join with sectionId
      newSocket.emit('join', {
        role: user.role,
        id: user.facultyProfileId || user.id,
        sectionId: null,
      });
    });

    // Global notification listeners
    const addNotification = (message) => {
      const id = Date.now() + Math.random();
      setNotifications((prev) => [{ id, message }, ...prev].slice(0, 10)); // Keep last 10
    };

    newSocket.on('timetable-updated', ({ changedSlot }) => {
      addNotification(
        changedSlot
          ? `Timetable updated — ${changedSlot.day} ${changedSlot.time}`
          : 'Timetable has been updated'
      );
    });

    newSocket.on('slot-opened', ({ slot }) => {
      addNotification(
        slot
          ? `Open slot available: ${slot.day} at ${slot.time}`
          : 'A slot is now available'
      );
    });

    newSocket.on('slot-claimed', ({ slotId }) => {
      addNotification('A slot has been claimed');
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    return () => {
      newSocket.off('timetable-updated');
      newSocket.off('slot-opened');
      newSocket.off('slot-claimed');
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('connect_error');
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [isAuthenticated, accessToken, user]);

  // Helper: let a view component join a specific section room
  const joinSection = useCallback((sectionId) => {
    if (!socketRef.current || !sectionId) return;
    socketRef.current.emit('join', {
      role: user?.role,
      id: user?.facultyProfileId || user?.id,
      sectionId,
    });
  }, [user]);

  const clearNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <SocketContext.Provider value={{ socket, notifications, clearNotification, joinSection }}>
      {children}
    </SocketContext.Provider>
  );
}
