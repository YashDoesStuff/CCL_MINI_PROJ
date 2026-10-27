/**
 * socket/socketHandler.js — Person 2
 * Initialises Socket.io and exposes getIO() for use in controllers.
 *
 * Client join payload: socket.emit('join', { role, id, sectionId })
 *
 * Rooms created:
 *   section-<sectionId>  → all students + faculty in that section
 *   faculty-<facultyId>  → individual faculty notifications
 *   admin                → admin-only broadcasts
 */

const { Server } = require("socket.io");

let io;

/**
 * initSocket — call once from server.js after creating http.Server
 * @param {import('http').Server} server
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    /**
     * Client emits 'join' after login:
     *   socket.emit('join', { role: 'student'|'faculty'|'admin', id, sectionId })
     */
    socket.on("join", ({ role, id, sectionId }) => {
      if (sectionId) {
        socket.join(`section-${sectionId}`);
      }
      if (role === "faculty" && id) {
        socket.join(`faculty-${id}`);
      }
      if (role === "admin") {
        socket.join("admin");
      }
      console.log(`[Socket.io] ${role} (${id}) joined section-${sectionId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
}

/**
 * getIO — returns the Socket.io Server instance.
 * Throws if initSocket() has not been called yet.
 */
function getIO() {
  if (!io) throw new Error("Socket.io not initialised — call initSocket() first");
  return io;
}

module.exports = { initSocket, getIO };
