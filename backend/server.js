require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// Route imports
const authRoutes = require("./routes/auth.routes");
const facultyRoutes = require("./routes/faculty.routes");
const roomRoutes = require("./routes/room.routes");
const subjectRoutes = require("./routes/subject.routes");
const sectionRoutes = require("./routes/section.routes");
const timetableRoutes = require("./routes/timetable.routes");
const uploadRoutes = require("./routes/upload.routes");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Classly API is running 🚀" });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/timetable", uploadRoutes);
// Person 2: also mount at /api so routes like /api/generate-timetable
// and /api/analytics/... resolve at the exact paths specified in the prompt
app.use("/api", timetableRoutes);

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ success: false, message: "Internal server error", error: err.message });
});

// ─── Connect DB then start server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5001;

// ─── Person 2: Wrap in http.Server + attach Socket.io ────────────────────────
const http = require("http");
const { initSocket } = require("./socket/socketHandler");
const server = http.createServer(app);
initSocket(server);

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.io ready`);
  });
});

module.exports = app;
