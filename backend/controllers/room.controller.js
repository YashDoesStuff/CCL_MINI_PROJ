const Room = require("../models/Room");

// GET /api/rooms
const getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find().lean();
    return res.status(200).json({ success: true, data: rooms });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/rooms/:id
const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).lean();
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    return res.status(200).json({ success: true, data: room });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/rooms
const createRoom = async (req, res) => {
  try {
    const { roomNumber, capacity } = req.body;
    if (!roomNumber || !capacity) {
      return res
        .status(400)
        .json({ success: false, message: "roomNumber and capacity are required" });
    }
    const room = await Room.create({ roomNumber, capacity });
    return res.status(201).json({ success: true, data: room });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Room number already exists" });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/rooms/:id
const updateRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    return res.status(200).json({ success: true, data: room });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/rooms/:id
const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id).lean();
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }
    return res.status(200).json({ success: true, message: "Room deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllRooms, getRoomById, createRoom, updateRoom, deleteRoom };
