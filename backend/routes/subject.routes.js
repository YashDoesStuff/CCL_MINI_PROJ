const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
} = require("../controllers/subject.controller");

router.use(verifyToken);

// GET /api/subjects        — all roles
router.get("/", getAllSubjects);

// GET /api/subjects/:id    — all roles
router.get("/:id", getSubjectById);

// POST /api/subjects       — admin only
router.post("/", authorize(["admin"]), createSubject);

// PUT /api/subjects/:id    — admin only
router.put("/:id", authorize(["admin"]), updateSubject);

// DELETE /api/subjects/:id — admin only
router.delete("/:id", authorize(["admin"]), deleteSubject);

module.exports = router;
