const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
} = require("../controllers/room.controller");

router.use(verifyToken);

// GET /api/rooms        — all roles
router.get("/", getAllRooms);

// GET /api/rooms/:id    — all roles
router.get("/:id", getRoomById);

// POST /api/rooms       — admin only
router.post("/", authorize(["admin"]), createRoom);

// PUT /api/rooms/:id    — admin only
router.put("/:id", authorize(["admin"]), updateRoom);

// DELETE /api/rooms/:id — admin only
router.delete("/:id", authorize(["admin"]), deleteRoom);

module.exports = router;
