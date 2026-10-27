const Section = require("../models/Section");

// GET /api/sections
const getAllSections = async (req, res) => {
  try {
    const sections = await Section.find()
      .populate({ path: "subjects", populate: { path: "facultyId", select: "name" } })
      .lean();
    return res.status(200).json({ success: true, data: sections });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sections/:id
const getSectionById = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id)
      .populate({ path: "subjects", populate: { path: "facultyId", select: "name" } })
      .lean();
    if (!section) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }
    return res.status(200).json({ success: true, data: section });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/sections
const createSection = async (req, res) => {
  try {
    const { name, semester, subjects } = req.body;
    if (!name || !semester) {
      return res
        .status(400)
        .json({ success: false, message: "name and semester are required" });
    }
    const section = await Section.create({ name, semester, subjects });
    return res.status(201).json({ success: true, data: section });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/sections/:id
const updateSection = async (req, res) => {
  try {
    const section = await Section.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!section) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }
    return res.status(200).json({ success: true, data: section });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/sections/:id
const deleteSection = async (req, res) => {
  try {
    const section = await Section.findByIdAndDelete(req.params.id).lean();
    if (!section) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }
    return res.status(200).json({ success: true, message: "Section deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllSections, getSectionById, createSection, updateSection, deleteSection };
