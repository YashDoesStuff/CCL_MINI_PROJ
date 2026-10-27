const Faculty = require("../models/Faculty");

// GET /api/faculty
const getAllFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.find().populate("subjects", "name").lean();
    return res.status(200).json({ success: true, data: faculty });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/faculty/:id
const getFacultyById = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate("subjects", "name")
      .lean();
    if (!faculty) {
      return res.status(404).json({ success: false, message: "Faculty not found" });
    }
    return res.status(200).json({ success: true, data: faculty });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/faculty
const createFaculty = async (req, res) => {
  try {
    const { name, subjects, unavailableSlots } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Faculty name is required" });
    }
    const faculty = await Faculty.create({ name, subjects, unavailableSlots });
    return res.status(201).json({ success: true, data: faculty });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/faculty/:id
const updateFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!faculty) {
      return res.status(404).json({ success: false, message: "Faculty not found" });
    }
    return res.status(200).json({ success: true, data: faculty });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/faculty/:id
const deleteFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndDelete(req.params.id).lean();
    if (!faculty) {
      return res.status(404).json({ success: false, message: "Faculty not found" });
    }
    return res.status(200).json({ success: true, message: "Faculty deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllFaculty, getFacultyById, createFaculty, updateFaculty, deleteFaculty };
