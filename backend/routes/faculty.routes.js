const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getAllFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
} = require("../controllers/faculty.controller");

// All faculty routes require authentication
router.use(verifyToken);

// GET /api/faculty        — all roles
router.get("/", getAllFaculty);

// GET /api/faculty/:id    — all roles
router.get("/:id", getFacultyById);

// POST /api/faculty       — admin only
router.post("/", authorize(["admin"]), createFaculty);

// PUT /api/faculty/:id    — admin only
router.put("/:id", authorize(["admin"]), updateFaculty);

// DELETE /api/faculty/:id — admin only
router.delete("/:id", authorize(["admin"]), deleteFaculty);

module.exports = router;
