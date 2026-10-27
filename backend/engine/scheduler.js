/**
 * scheduler.js — Person 2
 * Greedy constraint-based timetable generation engine.
 *
 * Rules:
 *  - ONE batch of DB reads before any loop — no DB calls inside loops.
 *  - Subjects sorted by most-constrained-first (fewest available slots).
 *  - Returns an array of slot objects; the controller saves them to DB.
 */

const Section   = require("../models/Section");
const Faculty   = require("../models/Faculty");
const Room      = require("../models/Room");
const Timetable = require("../models/Timetable");
const { checkConflicts } = require("./conflictEngine");

const DAYS  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIMES = ["9:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];

/**
 * generateTimetable
 * @param {string} sectionId  - MongoDB ObjectId of the section to schedule
 * @returns {Array}           - array of slot objects (unsaved)
 */
async function generateTimetable(sectionId) {
  // ── Step 1: ONE batch fetch — no DB calls after this point ──────────────────
  const section = await Section.findById(sectionId).populate("subjects").lean();
  if (!section) throw new Error(`Section ${sectionId} not found`);

  const allFaculty        = await Faculty.find({}).lean();
  const allRooms          = await Room.find({}).lean();
  const existingTimetables = await Timetable.find({}).lean();

  // Build a faculty lookup map for O(1) access
  const facultyMap = {};
  for (const f of allFaculty) {
    facultyMap[f._id.toString()] = f;
  }

  // Flatten all existing slots from all timetables into one array
  // This is the in-memory "global schedule" for conflict checking
  const globalSlots = [];
  for (const tt of existingTimetables) {
    // Skip the timetable being regenerated so we start fresh for this section
    if (tt.sectionId.toString() === sectionId.toString()) continue;
    for (const slot of tt.slots) {
      globalSlots.push(slot);
    }
  }

  // ── Step 2: Sort subjects by most-constrained-first ──────────────────────────
  // Count valid (non-unavailable) time slots per subject's faculty
  const totalSlots = DAYS.length * TIMES.length; // 35

  const subjectsWithScore = section.subjects.map((subject) => {
    const facultyId = subject.facultyId ? subject.facultyId.toString() : null;
    const faculty   = facultyId ? facultyMap[facultyId] : null;
    const unavailableCount = faculty
      ? faculty.unavailableSlots.filter(
          (us) => DAYS.includes(us.day) && TIMES.includes(us.time)
        ).length
      : 0;
    const availableSlots = totalSlots - unavailableCount;
    return { subject, availableSlots };
  });

  // Ascending sort — fewest available = schedule first
  subjectsWithScore.sort((a, b) => a.availableSlots - b.availableSlots);

  // ── Step 3: Greedy assignment ─────────────────────────────────────────────────
  const assignedSlots = []; // slots created for THIS section

  for (const { subject } of subjectsWithScore) {
    const facultyId = subject.facultyId ? subject.facultyId.toString() : null;
    const faculty   = facultyId ? facultyMap[facultyId] : null;
    let slotAssigned = false;

    outerLoop: for (const day of DAYS) {
      for (const time of TIMES) {
        // Pick any available room (first fit)
        let assignedRoom = null;
        for (const room of allRooms) {
          const proposedSlot = {
            day,
            time,
            facultyId:        facultyId,
            roomId:           room._id.toString(),
            unavailableSlots: faculty ? (faculty.unavailableSlots || []) : [], // passed here, engine stays DB-free
          };

          // Check against global existing + already assigned slots this session
          const allCurrentSlots = [...globalSlots, ...assignedSlots];
          const { hasConflict } = checkConflicts(
            allCurrentSlots,
            proposedSlot,
            null // excludeSlotId — nothing to exclude during generation
          );

          if (!hasConflict) {
            assignedRoom = room;
            break;
          }
        }

        if (assignedRoom) {
          const newSlot = {
            day,
            time,
            subjectId: subject._id,
            facultyId: facultyId || null,
            roomId: assignedRoom._id,
            status: "scheduled",
            lastUpdatedBy: null,
            lastUpdatedAt: new Date(),
            cancelledBy: null,
          };
          assignedSlots.push(newSlot);
          // Also add to globalSlots so next subjects see it as taken
          globalSlots.push(newSlot);
          slotAssigned = true;
          break outerLoop;
        }
      }
    }

    if (!slotAssigned) {
      console.warn(
        `[Scheduler] Could not assign a slot for subject: ${subject.name} (${subject._id})`
      );
    }
  }

  // ── Step 4: Return assigned slots; controller saves to DB ────────────────────
  return assignedSlots;
}

module.exports = { generateTimetable };
