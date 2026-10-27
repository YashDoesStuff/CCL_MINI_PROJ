const Subject = require("../models/Subject");

// GET /api/subjects
const getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().populate("facultyId", "name").lean();
    return res.status(200).json({ success: true, data: subjects });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/subjects/:id
const getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate("facultyId", "name")
      .lean();
    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }
    return res.status(200).json({ success: true, data: subject });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/subjects
const createSubject = async (req, res) => {
  try {
    const { name, facultyId } = req.body;
    if (!name || !facultyId) {
      return res
        .status(400)
        .json({ success: false, message: "name and facultyId are required" });
    }
    const subject = await Subject.create({ name, facultyId });
    return res.status(201).json({ success: true, data: subject });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/subjects/:id
const updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }
    return res.status(200).json({ success: true, data: subject });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/subjects/:id
const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id).lean();
    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }
    return res.status(200).json({ success: true, message: "Subject deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllSubjects, getSubjectById, createSubject, updateSubject, deleteSubject };
