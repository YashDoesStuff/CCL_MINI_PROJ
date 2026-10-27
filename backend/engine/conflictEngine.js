/**
 * conflictEngine.js — Person 2
 * Pure in-memory conflict checker. ZERO database calls allowed inside this file.
 * All data must be fetched by the caller before invoking checkConflicts().
 *
 * @param {Array}  existingSlots        - flat array of slot objects already in memory
 * @param {Object} newSlot              - { day, time, facultyId, roomId, unavailableSlots? }
 *                                        Caller passes faculty's unavailableSlots inside newSlot
 *                                        so this function stays completely DB-free.
 * @param {*}      [excludeSlotId=null] - slot._id to ignore (used during drag-drop updates)
 * @returns {{ hasConflict: Boolean, reason: String }}
 */
function checkConflicts(existingSlots, newSlot, excludeSlotId = null) {
  const { day, time, facultyId, roomId, unavailableSlots } = newSlot;

  // Convert IDs to string for safe equality comparison
  const newFacultyId = facultyId ? facultyId.toString() : null;
  const newRoomId    = roomId    ? roomId.toString()    : null;
  const excludeId    = excludeSlotId ? excludeSlotId.toString() : null;

  for (const slot of existingSlots) {
    // Skip the slot being updated (drag-drop scenario)
    if (excludeId && slot._id && slot._id.toString() === excludeId) continue;

    // Only check slots on the same day + time
    if (slot.day !== day || slot.time !== time) continue;

    // ── Check 1: Faculty clash ────────────────────────────────────────────────
    if (
      newFacultyId &&
      slot.facultyId &&
      slot.facultyId.toString() === newFacultyId
    ) {
      return {
        hasConflict: true,
        reason: `Faculty clash: this faculty is already scheduled at ${day} ${time}`,
      };
    }

    // ── Check 2: Room clash ───────────────────────────────────────────────────
    if (
      newRoomId &&
      slot.roomId &&
      slot.roomId.toString() === newRoomId
    ) {
      return {
        hasConflict: true,
        reason: `Room clash: this room is already booked at ${day} ${time}`,
      };
    }
  }

  // ── Check 3: Faculty unavailability ──────────────────────────────────────────
  // Caller fetches the faculty doc from DB and passes unavailableSlots inside newSlot.
  // This function itself makes zero DB calls.
  if (Array.isArray(unavailableSlots)) {
    const isUnavailable = unavailableSlots.some(
      (us) => us.day === day && us.time === time
    );
    if (isUnavailable) {
      return {
        hasConflict: true,
        reason: `Faculty unavailable: this faculty has marked ${day} ${time} as unavailable`,
      };
    }
  }

  return { hasConflict: false, reason: "" };
}

module.exports = { checkConflicts };
