const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getAllSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
} = require("../controllers/section.controller");

router.use(verifyToken);

// GET /api/sections        — all roles
router.get("/", getAllSections);

// GET /api/sections/:id    — all roles
router.get("/:id", getSectionById);

// POST /api/sections       — admin only
router.post("/", authorize(["admin"]), createSection);

// PUT /api/sections/:id    — admin only
router.put("/:id", authorize(["admin"]), updateSection);

// DELETE /api/sections/:id — admin only
router.delete("/:id", authorize(["admin"]), deleteSection);

module.exports = router;
