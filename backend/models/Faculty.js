const mongoose = require("mongoose");

const unavailableSlotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    time: { type: String, required: true },
  },
  { _id: false }
);

const facultySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Faculty name is required"],
      trim: true,
    },
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    unavailableSlots: [unavailableSlotSchema],
  },
  { timestamps: true }
);

// Index for scheduling engine lookups
facultySchema.index({ "unavailableSlots.day": 1, "unavailableSlots.time": 1 });

module.exports = mongoose.model("Faculty", facultySchema);
