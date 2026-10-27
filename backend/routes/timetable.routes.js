/**
 * routes/timetable.routes.js — Person 2 (replaces Person 1's stub)
 *
 * Mounts at: /api/timetable  (set in server.js by Person 1)
 *
 * Person 1's original routes are preserved.
 * Person 2 adds: generate, update-slot, cancel-slot, claim-slot,
 *                assign-slot, faculty timetable, and analytics endpoints.
 */

const express  = require("express");
const router   = express.Router();

// Person 1's middleware (imported exactly as they export them)
const verifyToken = require("../middleware/auth");
const authorize   = require("../middleware/role");

const {
  // ── Person 1 pass-throughs ──────────────────────────────────────────────
  getTimetableBySectionId,
  getAllTimetables,
  createTimetable,
  updateTimetable,
  updateSlot,
  // ── Person 2 — engine controllers ──────────────────────────────────────
  generateTimetableController,
  updateSlotController,
  cancelSlotController,
  claimSlotController,
  assignSlotController,
  getTimetableController,
  getFacultyTimetableController,
  addExtraSlotController,
  // ── Person 2 — analytics ───────────────────────────────────────────────
  getFacultyWorkloadController,
  getRoomUtilizationController,
} = require("../controllers/timetable.controller");


// Apply auth to every route in this router
router.use(verifyToken);

// ─── Person 1's original routes (unchanged) ──────────────────────────────────
router.get("/",                                             getAllTimetables);
router.post("/",                  authorize(["admin"]),    createTimetable);
router.put("/:sectionId([0-9a-fA-F]{24})",         authorize(["admin"]),    updateTimetable);
router.patch(
  "/:sectionId([0-9a-fA-F]{24})/slot/:slotId",
  authorize(["admin", "faculty"]),
  updateSlot
);

// ─── Person 2 — Scheduling engine ────────────────────────────────────────────
// POST /api/timetable/generate-timetable
router.post("/generate-timetable", authorize(["admin"]), generateTimetableController);

// ─── Person 2 — Slot management ──────────────────────────────────────────────
// PUT  /api/timetable/update-slot
router.put("/update-slot",  authorize(["admin"]),           updateSlotController);

// POST /api/timetable/cancel-slot
router.post("/cancel-slot", authorize(["admin", "faculty"]), cancelSlotController);

// POST /api/timetable/claim-slot
router.post("/claim-slot",  authorize(["faculty"]),          claimSlotController);

// POST /api/timetable/assign-slot
router.post("/assign-slot", authorize(["admin"]),            assignSlotController);

// POST /api/timetable/add-extra-slot
router.post("/add-extra-slot", authorize(["faculty"]),      addExtraSlotController);

// ─── Person 2 — Faculty-specific view ────────────────────────────────────────
// GET /api/timetable/faculty/:facultyId
router.get("/faculty/:facultyId", getFacultyTimetableController);

// ─── Person 2 — Analytics (admin only, computed on demand) ───────────────────
// GET /api/timetable/analytics/faculty-workload
router.get(
  "/analytics/faculty-workload",
  authorize(["admin"]),
  getFacultyWorkloadController
);

// GET /api/timetable/analytics/room-utilization
router.get(
  "/analytics/room-utilization",
  authorize(["admin"]),
  getRoomUtilizationController
);

// GET /api/timetable/:sectionId
router.get("/:sectionId([0-9a-fA-F]{24})",                getTimetableBySectionId);

module.exports = router;
