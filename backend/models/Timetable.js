const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    time: { type: String, required: true },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      default: null,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "open"],
      default: "scheduled",
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastUpdatedAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const timetableSchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      unique: true, // one timetable per section
    },
    slots: [slotSchema],
  },
  { timestamps: true }
);

// Compound indexes for conflict detection (used by Person 2's engine)
// Note: sectionId unique:true already creates a single-field index
timetableSchema.index({ "slots.facultyId": 1, "slots.day": 1, "slots.time": 1 });
timetableSchema.index({ "slots.roomId": 1, "slots.day": 1, "slots.time": 1 });
timetableSchema.index({ "slots.day": 1, "slots.time": 1 });

module.exports = mongoose.model("Timetable", timetableSchema);
