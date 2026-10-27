/**
 * controllers/timetable.controller.js — Person 2 (replaces Person 1's stub)
 *
 * Extends Person 1's basic CRUD with:
 *   - Scheduling engine integration
 *   - Conflict-checked slot updates
 *   - Cancel / claim flow (atomic for claim)
 *   - Socket.io real-time events (minimal payload — changed slot only)
 *   - Analytics: faculty workload + room utilisation (computed on demand)
 *
 * ALL controllers wrapped in try/catch.
 * ALL responses use res.json() — never res.send().
 * ALL read-only queries use .lean().
 */

const mongoose = require("mongoose");
const Timetable = require("../models/Timetable");
const Faculty   = require("../models/Faculty");
const { generateTimetable } = require("../engine/scheduler");
const { checkConflicts }    = require("../engine/conflictEngine");
const { getIO }             = require("../socket/socketHandler");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Flatten all slots from multiple timetable docs into one array */
function flattenSlots(timetables) {
  return timetables.flatMap((tt) => tt.slots || []);
}

/** Safe socket emit — never throws if socket isn't ready */
function safeEmit(event, room, payload) {
  try {
    getIO().to(room).emit(event, payload);
  } catch (e) {
    console.warn(`[Socket] emit failed (${event}):`, e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Person 1 pass-through controllers (kept so existing routes don't break)
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/timetable/:sectionId — all roles */
const getTimetableBySectionId = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.sectionId)) {
      return res.status(400).json({ success: false, message: "Invalid sectionId" });
    }
    const timetable = await Timetable.findOne({ sectionId: req.params.sectionId })
      .populate("sectionId", "name semester")
      .populate("slots.subjectId", "name")
      .populate("slots.facultyId", "name")
      .populate("slots.roomId", "roomNumber capacity")
      .populate("slots.lastUpdatedBy", "name email role")
      .lean();

    if (!timetable) {
      return res.status(404).json({ success: false, message: "Timetable not found for this section" });
    }
    return res.status(200).json({ success: true, data: timetable });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/timetable — admin use */
const getAllTimetables = async (req, res) => {
  try {
    const timetables = await Timetable.find()
      .populate("sectionId", "name semester")
      .lean();
    return res.status(200).json({ success: true, data: timetables });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** POST /api/timetable — raw create (used by Person 1's original route) */
const createTimetable = async (req, res) => {
  try {
    const { sectionId, slots } = req.body;
    if (!sectionId) {
      return res.status(400).json({ success: false, message: "sectionId is required" });
    }
    const existing = await Timetable.findOne({ sectionId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Timetable for this section already exists. Use PUT to update.",
      });
    }
    const timetable = await Timetable.create({ sectionId, slots: slots || [] });
    return res.status(201).json({ success: true, data: timetable });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** PUT /api/timetable/:sectionId — full slots replace */
const updateTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findOneAndUpdate(
      { sectionId: req.params.sectionId },
      { slots: req.body.slots },
      { new: true, runValidators: true }
    ).lean();
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }
    return res.status(200).json({ success: true, data: timetable });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** PATCH /api/timetable/:sectionId/slot/:slotId — Person 1's atomic slot update */
const updateSlot = async (req, res) => {
  try {
    const { sectionId, slotId } = req.params;
    const updates = req.body;

    const setPayload = {};
    Object.keys(updates).forEach((key) => {
      setPayload[`slots.$.${key}`] = updates[key];
    });
    setPayload["slots.$.lastUpdatedBy"] = req.user.id;
    setPayload["slots.$.lastUpdatedAt"] = new Date();

    const timetable = await Timetable.findOneAndUpdate(
      { sectionId, "slots._id": slotId },
      { $set: setPayload },
      { new: true }
    ).lean();

    if (!timetable) {
      return res.status(404).json({ success: false, message: "Timetable or slot not found" });
    }
    const updatedSlot = timetable.slots.find((s) => s._id.toString() === slotId);
    return res.status(200).json({ success: true, data: updatedSlot });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Person 2 — new controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/generate-timetable
 * Role: Admin only
 * Body: { sectionId }
 */
const generateTimetableController = async (req, res) => {
  try {
    const { sectionId } = req.body;
    if (!sectionId) {
      return res.status(400).json({ success: false, message: "sectionId is required" });
    }

    // Run the greedy engine (all DB reads happen inside, before any loop)
    const slots = await generateTimetable(sectionId);

    // Upsert: update existing or create new
    const savedTimetable = await Timetable.findOneAndUpdate(
      { sectionId },
      { sectionId, slots },
      { new: true, upsert: true, runValidators: true }
    );

    // Emit to everyone in that section's room
    safeEmit("timetable-updated", `section-${sectionId}`, {
      sectionId,
      changedSlot: null, // full regeneration — no single changed slot
    });

    return res.status(200).json({ success: true, data: savedTimetable });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/update-slot
 * Role: Admin only
 * Body: { timetableId, slotId, updates: { subjectId, facultyId, roomId, day, time } }
 */
const updateSlotController = async (req, res) => {
  try {
    const { timetableId, slotId, updates } = req.body;
    if (!timetableId || !slotId || !updates) {
      return res.status(400).json({ success: false, message: "timetableId, slotId, and updates are required" });
    }

    // Fetch timetable + all others for global conflict view
    const timetable = await Timetable.findById(timetableId).lean();
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }

    const otherTimetables = await Timetable.find({ _id: { $ne: timetableId } }).lean();
    const globalSlots = [...timetable.slots, ...flattenSlots(otherTimetables)];

    // Fetch faculty doc upfront (one DB call outside the engine) for unavailability data
    let unavailableSlots = [];
    if (updates.facultyId) {
      const facultyDoc = await Faculty.findById(updates.facultyId).lean();
      if (facultyDoc) unavailableSlots = facultyDoc.unavailableSlots || [];
    }

    // In-memory conflict check — pass unavailableSlots inside newSlot, exclude updated slot
    const proposedSlot = {
      day:              updates.day,
      time:             updates.time,
      facultyId:        updates.facultyId,
      roomId:           updates.roomId,
      unavailableSlots, // caller-fetched, engine stays DB-free
    };

    const { hasConflict, reason } = checkConflicts(globalSlots, proposedSlot, slotId);
    if (hasConflict) {
      return res.status(409).json({ success: false, message: `Conflict: ${reason}` });
    }

    // Build $set payload for the matched slot
    const setPayload = {};
    const allowedFields = ["subjectId", "facultyId", "roomId", "day", "time", "status"];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setPayload[`slots.$.${field}`] = updates[field];
      }
    }
    setPayload["slots.$.lastUpdatedBy"] = req.user.id;
    setPayload["slots.$.lastUpdatedAt"] = new Date();

    const updated = await Timetable.findOneAndUpdate(
      { _id: timetableId, "slots._id": slotId },
      { $set: setPayload },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Slot not found in timetable" });
    }

    const changedSlot = updated.slots.find((s) => s._id.toString() === slotId);

    // Emit only the changed slot — never the full timetable
    safeEmit("timetable-updated", `section-${updated.sectionId}`, {
      sectionId: updated.sectionId,
      changedSlot,
    });

    return res.status(200).json({ success: true, data: changedSlot });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/cancel-slot
 * Role: Admin OR Faculty (faculty can only cancel their own slot)
 * Body: { timetableId, slotId, facultyProfileId? }
 *
 * Faculty ownership check uses facultyProfileId from the request body (sent by frontend).
 * This avoids the unreliable name-regex DB lookup that caused 403 errors.
 */
const cancelSlotController = async (req, res) => {
  try {
    const { timetableId, slotId, facultyProfileId } = req.body;
    if (!timetableId || !slotId) {
      return res.status(400).json({ success: false, message: "timetableId and slotId are required" });
    }

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }

    const slot = timetable.slots.id(slotId);
    if (!slot) {
      return res.status(404).json({ success: false, message: "Slot not found" });
    }

    // Faculty can only cancel their own slot.
    if (req.user.role === "faculty") {
      if (!slot.facultyId) {
        return res.status(403).json({ success: false, message: "This slot has no assigned faculty" });
      }

      // Fetch the actual User to get the name, because req.user from JWT only has id and role
      const User = require("../models/User");
      const loggedInUser = await User.findById(req.user.id).lean();
      const myName = loggedInUser?.name || "";

      let myFacultyId = facultyProfileId ? facultyProfileId.toString() : null;

      if (!myFacultyId) {
        // Fallback: look up Faculty doc by user name
        const cleanName = myName ? myName.replace(/^(Prof\.|Professor|Dr\.|Dr|Mr\.|Mr|Mrs\.|Ms\.|Ms|Sir|Madam|Shri|Smt)\s+/i, '').trim() : '';
        const myFacultyDoc = await Faculty.findOne({
          name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        }).lean();
        myFacultyId = myFacultyDoc?._id?.toString() || null;
      }

      const slotFacultyId = slot.facultyId?.toString();
      
      // Secondary fallback: retrieve the actual Faculty document attached to the slot 
      // and check if its name matches the logged-in user's name.
      let nameMatches = false;
      if (myFacultyId !== slotFacultyId) {
        const slotFacultyDoc = await Faculty.findById(slot.facultyId).lean();
        if (slotFacultyDoc && myName) {
          const myClean = myName.replace(/^(Prof\.|Professor|Dr\.|Dr|Mr\.|Mr|Mrs\.|Ms\.|Ms|Sir|Madam|Shri|Smt)\s+/i, '').toLowerCase().trim();
          const slotClean = slotFacultyDoc.name.replace(/^(Prof\.|Professor|Dr\.|Dr|Mr\.|Mr|Mrs\.|Ms\.|Ms|Sir|Madam|Shri|Smt)\s+/i, '').toLowerCase().trim();
          if (myClean === slotClean) {
            nameMatches = true;
          }
        }
      }

      if (!nameMatches && (!myFacultyId || myFacultyId !== slotFacultyId)) {
        return res.status(403).json({ success: false, message: "You can only cancel your own lectures" });
      }
    }

    // Flip to 'open' immediately so eligible faculty can claim it
    slot.status         = "open";
    slot.cancelledBy    = req.user.role;
    slot.lastUpdatedBy  = req.user.id;
    slot.lastUpdatedAt  = new Date();

    await timetable.save();

    // Populate the saved slot for the socket payload
    const freshTimetable = await Timetable.findById(timetableId)
      .populate("slots.subjectId", "name")
      .populate("slots.facultyId", "name")
      .populate("slots.roomId", "roomNumber")
      .lean();
    const openSlot = freshTimetable?.slots?.find((s) => s._id.toString() === slotId);
    const slotPayload = { slot: openSlot, sectionId: timetable.sectionId };

    // Notify ALL faculty who teach this subject
    const eligibleFaculty = await Faculty.find({ subjects: slot.subjectId }).lean();
    for (const ef of eligibleFaculty) {
      safeEmit("slot-opened", `faculty-${ef._id}`, slotPayload);
    }

    // Notify section room (students + all faculty) so grid turns yellow
    safeEmit("timetable-updated", `section-${timetable.sectionId}`, {
      sectionId: timetable.sectionId,
      changedSlot: openSlot,
    });

    return res.status(200).json({ success: true, message: "Slot cancelled and now open for claiming", data: openSlot });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/claim-slot
 * Role: Faculty only
 * Body: { timetableId, slotId, facultyProfileId?, subjectId?, roomId? }
 *
 * ATOMIC — uses findOneAndUpdate with status condition to prevent race conditions.
 * subjectId and roomId are optional: if provided they REPLACE the cancelled slot's
 * old values so the claiming teacher is not stuck with another teacher's details.
 */
const claimSlotController = async (req, res) => {
  try {
    const { timetableId, slotId, facultyProfileId, subjectId, roomId } = req.body;
    if (!timetableId || !slotId) {
      return res.status(400).json({ success: false, message: "timetableId and slotId are required" });
    }

    // Resolve the Faculty _id: prefer explicitly passed facultyProfileId,
    // otherwise look up by user name
    let claimingFacultyId = facultyProfileId ? facultyProfileId.toString() : null;

    if (!claimingFacultyId) {
      const User = require("../models/User");
      const loggedInUser = await User.findById(req.user.id).lean();
      const myName = loggedInUser?.name || "";

      // Fallback: look up Faculty doc by user name
      const cleanName = myName ? myName.replace(/^(Prof\.|Professor|Dr\.|Dr|Mr\.|Mr|Mrs\.|Mrs|Ms\.|Ms|Sir|Madam|Shri|Smt)\s+/i, '').trim() : '';
      const myFacultyDoc = await Faculty.findOne({
        name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }).lean();
      claimingFacultyId = myFacultyDoc?._id?.toString() || null;
    }

    if (!claimingFacultyId) {
      return res.status(400).json({ success: false, message: "Could not resolve Faculty Profile ID. Please re-login or check your registered name." });
    }

    // Build the atomic $set — always update faculty & status;
    // update subject/room only when the claiming teacher provided new ones.
    const setPayload = {
      "slots.$.status":        "scheduled",
      "slots.$.facultyId":     claimingFacultyId,
      "slots.$.lastUpdatedBy": req.user.id,
      "slots.$.lastUpdatedAt": new Date(),
      "slots.$.cancelledBy":   null,
    };
    if (subjectId) setPayload["slots.$.subjectId"] = subjectId;
    if (roomId)    setPayload["slots.$.roomId"]    = roomId;

    // Atomic update: only succeeds if slot is currently "open"
    const result = await Timetable.findOneAndUpdate(
      {
        _id: timetableId,
        slots: { $elemMatch: { _id: slotId, status: "open" } }
      },
      { $set: setPayload },
      { new: true }
    );

    if (!result) {
      return res.status(409).json({ success: false, message: "Slot already claimed or not open" });
    }

    // Populate the claimed slot for a rich socket payload
    const freshTimetable = await Timetable.findById(timetableId)
      .populate("slots.subjectId", "name")
      .populate("slots.facultyId", "name")
      .populate("slots.roomId", "roomNumber")
      .lean();
    const claimedSlot = freshTimetable?.slots?.find((s) => s._id.toString() === slotId);

    // Emit to the whole section so students AND faculty see the update live
    safeEmit("timetable-updated", `section-${result.sectionId}`, {
      sectionId: result.sectionId,
      changedSlot: claimedSlot,
    });

    return res.status(200).json({ success: true, message: "Slot claimed successfully", data: claimedSlot });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/assign-slot
 * Role: Admin only
 * Body: { timetableId, slotId, facultyId }
 */
const assignSlotController = async (req, res) => {
  try {
    const { timetableId, slotId, facultyId } = req.body;
    if (!timetableId || !slotId || !facultyId) {
      return res.status(400).json({ success: false, message: "timetableId, slotId, and facultyId are required" });
    }

    const timetable = await Timetable.findById(timetableId).lean();
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }

    const slot = timetable.slots.find((s) => s._id.toString() === slotId);
    if (!slot) {
      return res.status(404).json({ success: false, message: "Slot not found" });
    }

    const otherTimetables = await Timetable.find({ _id: { $ne: timetableId } }).lean();
    const globalSlots = [...timetable.slots, ...flattenSlots(otherTimetables)];

    // Fetch faculty doc upfront so engine stays DB-free
    const facultyDoc = await Faculty.findById(facultyId).lean();
    const unavailableSlots = facultyDoc ? facultyDoc.unavailableSlots || [] : [];

    const proposedSlot = {
      day:              slot.day,
      time:             slot.time,
      facultyId,
      roomId:           slot.roomId,
      unavailableSlots, // passed inside newSlot — engine makes zero DB calls
    };
    const { hasConflict, reason } = checkConflicts(globalSlots, proposedSlot, slotId);
    if (hasConflict) {
      return res.status(409).json({ success: false, message: `Conflict: ${reason}` });
    }

    const updated = await Timetable.findOneAndUpdate(
      { _id: timetableId, "slots._id": slotId },
      {
        $set: {
          "slots.$.facultyId":     facultyId,
          "slots.$.lastUpdatedBy": req.user.id,
          "slots.$.lastUpdatedAt": new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Update failed" });
    }

    const changedSlot = updated.slots.find((s) => s._id.toString() === slotId);

    safeEmit("timetable-updated", `section-${updated.sectionId}`, {
      sectionId: updated.sectionId,
      changedSlot,
    });

    return res.status(200).json({ success: true, data: changedSlot });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/timetable/:sectionId
 * Role: All roles (handled by route-level verifyToken)
 */
const getTimetableController = async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ sectionId: req.params.sectionId })
      .populate("slots.subjectId", "name")
      .populate("slots.facultyId", "name")
      .populate("slots.roomId", "roomNumber")
      .lean();

    if (!timetable) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }
    return res.status(200).json({ success: true, data: timetable });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/timetable/faculty/:facultyId
 * Role: Admin or the specific faculty themselves
 */
const getFacultyTimetableController = async (req, res) => {
  try {
    const { facultyId } = req.params;

    // Guard: faculty can only view their own timetable
    if (req.user.role === "faculty" && req.user.id !== facultyId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const allTimetables = await Timetable.find()
      .populate("slots.subjectId", "name")
      .populate("slots.facultyId", "name")
      .populate("slots.roomId", "roomNumber")
      .populate("sectionId", "name semester")
      .lean();

    // Filter: keep only slots that belong to this faculty
    const facultySlots = [];
    for (const tt of allTimetables) {
      const matching = (tt.slots || []).filter(
        (s) => s.facultyId && s.facultyId._id
          ? s.facultyId._id.toString() === facultyId
          : s.facultyId && s.facultyId.toString() === facultyId
      );
      if (matching.length) {
        facultySlots.push({
          section: tt.sectionId,
          slots: matching,
        });
      }
    }

    return res.status(200).json({ success: true, data: facultySlots });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — computed on demand, never stored in DB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/faculty-workload
 * Role: Admin only
 * Returns: [{ facultyId, name, scheduledSlots }]
 */
const getFacultyWorkloadController = async (req, res) => {
  try {
    const allTimetables = await Timetable.find()
      .populate("slots.facultyId", "name")
      .lean();

    const workloadMap = {}; // facultyId → { name, count }

    for (const tt of allTimetables) {
      for (const slot of tt.slots || []) {
        if (slot.status !== "scheduled" || !slot.facultyId) continue;

        const fId   = slot.facultyId._id
          ? slot.facultyId._id.toString()
          : slot.facultyId.toString();
        const fName = slot.facultyId.name || "Unknown";

        if (!workloadMap[fId]) {
          workloadMap[fId] = { facultyId: fId, name: fName, scheduledSlots: 0 };
        }
        workloadMap[fId].scheduledSlots += 1;
      }
    }

    const result = Object.values(workloadMap).sort(
      (a, b) => b.scheduledSlots - a.scheduledSlots
    );
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/analytics/room-utilization
 * Role: Admin only
 * Returns: [{ roomId, roomNumber, utilization: [{ day, count }] }]
 */
const getRoomUtilizationController = async (req, res) => {
  try {
    const allTimetables = await Timetable.find()
      .populate("slots.roomId", "roomNumber")
      .lean();

    // roomId → { roomNumber, days: { day → count } }
    const roomMap = {};

    for (const tt of allTimetables) {
      for (const slot of tt.slots || []) {
        if (slot.status !== "scheduled" || !slot.roomId) continue;

        const rId     = slot.roomId._id
          ? slot.roomId._id.toString()
          : slot.roomId.toString();
        const rNumber = slot.roomId.roomNumber || rId;

        if (!roomMap[rId]) {
          roomMap[rId] = { roomId: rId, roomNumber: rNumber, days: {} };
        }
        roomMap[rId].days[slot.day] = (roomMap[rId].days[slot.day] || 0) + 1;
      }
    }

    const result = Object.values(roomMap).map((room) => ({
      roomId:      room.roomId,
      roomNumber:  room.roomNumber,
      utilization: Object.entries(room.days).map(([day, count]) => ({ day, count })),
    }));

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Extra Lecture — Faculty assigns themselves to a free (empty) slot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/timetable/add-extra-slot
 * Role: Faculty only
 * Body: { timetableId, day, time, roomId, facultyProfileId }
 */
const addExtraSlotController = async (req, res) => {
  try {
    const { timetableId, day, time, roomId, subjectId, facultyProfileId } = req.body;
    if (!timetableId || !day || !time) {
      return res.status(400).json({ success: false, message: "timetableId, day, and time are required" });
    }

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ success: false, message: "Timetable not found" });
    }

    // Resolve the Faculty._id
    let assignedFacultyId = facultyProfileId ? facultyProfileId.toString() : null;

    if (!assignedFacultyId) {
      const User = require("../models/User");
      const loggedInUser = await User.findById(req.user.id).lean();
      const myName = loggedInUser?.name || "";

      // Fallback: look up Faculty doc by user name
      const cleanName = myName ? myName.replace(/^(Prof\.|Professor|Dr\.|Dr|Mr\.|Mr|Mrs\.|Mrs|Ms\.|Ms|Sir|Madam|Shri|Smt)\s+/i, '').trim() : '';
      const myFacultyDoc = await Faculty.findOne({
        name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }).lean();
      assignedFacultyId = myFacultyDoc?._id?.toString() || null;
    }

    if (!assignedFacultyId) {
      return res.status(400).json({ success: false, message: "Could not resolve Faculty Profile ID. Please re-login or check your registered name." });
    }

    // Check no existing scheduled slot at this day/time
    const conflict = timetable.slots.find(
      (s) => s.day === day && s.time === time && s.status === "scheduled"
    );
    if (conflict) {
      return res.status(409).json({ success: false, message: "A lecture is already scheduled at this time" });
    }

    timetable.slots.push({
      day,
      time,
      subjectId: subjectId || null,
      facultyId: assignedFacultyId,
      roomId: roomId || null,
      status: "scheduled",
      lastUpdatedBy: req.user.id,
      lastUpdatedAt: new Date(),
    });
    await timetable.save();

    // Re-fetch with population so the socket payload has full names
    const freshTimetable = await Timetable.findById(timetableId)
      .populate("slots.subjectId", "name")
      .populate("slots.facultyId", "name")
      .populate("slots.roomId", "roomNumber")
      .lean();
    const savedSlot = freshTimetable?.slots?.[freshTimetable.slots.length - 1];

    safeEmit("timetable-updated", `section-${timetable.sectionId}`, {
      sectionId: timetable.sectionId,
      changedSlot: savedSlot,
    });

    return res.status(201).json({ success: true, message: "Extra lecture added", data: savedSlot });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // Person 1 pass-throughs
  getTimetableBySectionId,
  getAllTimetables,
  createTimetable,
  updateTimetable,
  updateSlot,
  // Person 2 — engine controllers
  generateTimetableController,
  updateSlotController,
  cancelSlotController,
  claimSlotController,
  assignSlotController,
  getTimetableController,
  getFacultyTimetableController,
  addExtraSlotController,
  // Person 2 — analytics
  getFacultyWorkloadController,
  getRoomUtilizationController,
};
