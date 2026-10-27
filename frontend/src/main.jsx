import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';

createRoot(document.getElementById('root')).render(
  // NOTE: StrictMode intentionally removed — react-beautiful-dnd has
  // a known double-invoke issue with React 18 StrictMode.
  // StrictMode can be re-enabled after migrating to @hello-pangea/dnd.
  <AuthProvider>
    <SocketProvider>
      <App />
    </SocketProvider>
  </AuthProvider>
);
