const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: [true, "Faculty reference is required"],
    },
  },
  { timestamps: true }
);

// Index for efficient faculty-subject lookups
subjectSchema.index({ facultyId: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
