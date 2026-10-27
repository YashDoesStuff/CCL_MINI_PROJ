const { checkConflicts } = require("../engine/conflictEngine");

const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function normalizeName(value = "") {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeDay(value) {
  if (!value) return null;
  const token = normalizeName(value).slice(0, 3);
  const mapping = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };
  return mapping[token] || null;
}

function normalizeTime(value) {
  if (!value) return null;
  const str = value.toString().trim();
  const match = str.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? match[2] : "00";
  if (Number.isNaN(hour)) return null;
  return `${hour}:${minute}`;
}

function isObjectId(value) {
  return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
}

function buildLookupMap(items, keySelector) {
  const map = new Map();
  items.forEach((item) => {
    const key = keySelector(item);
    if (key) map.set(normalizeName(key), item);
  });
  return map;
}

function resolveSectionId(slot, sectionIdOverride, sectionsByName) {
  if (sectionIdOverride) return sectionIdOverride;
  if (slot.sectionId && isObjectId(slot.sectionId)) return slot.sectionId;
  const name = slot.sectionName || slot.section || slot.sectionTitle;
  if (!name) return null;
  const match = sectionsByName.get(normalizeName(name));
  return match ? match._id.toString() : null;
}

function resolveSubjectId(slot, subjectsByName) {
  if (slot.subjectId && isObjectId(slot.subjectId)) return slot.subjectId;
  const name = slot.subjectName || slot.subject || slot.course || slot.paper;
  if (!name) return null;
  const match = subjectsByName.get(normalizeName(name));
  return match ? match._id.toString() : null;
}

function resolveFacultyId(slot, facultyByName) {
  if (slot.facultyId && isObjectId(slot.facultyId)) return slot.facultyId;
  const name = slot.facultyName || slot.faculty || slot.teacher || slot.instructor;
  if (!name) return null;
  const match = facultyByName.get(normalizeName(name));
  return match ? match._id.toString() : null;
}

function resolveRoomId(slot, roomsByNumber) {
  if (slot.roomId && isObjectId(slot.roomId)) return slot.roomId;
  const name = slot.roomNumber || slot.room || slot.classroom;
  if (!name) return null;
  const match = roomsByNumber.get(normalizeName(name));
  return match ? match._id.toString() : null;
}

function mapSlots({
  slots,
  sectionIdOverride,
  subjectAbbrevMap = {},
  facultyAbbrevMap = {},
  sections,
  subjects,
  faculty,
  rooms,
  existingSlots,
}) {
  const warnings = [];
  const conflicts = [];

  const sectionsByName = buildLookupMap(sections, (s) => s.name);
  const subjectsByName = buildLookupMap(subjects, (s) => s.name);
  const subjectsById = new Map(subjects.map((s) => [s._id.toString(), s]));
  const facultyByName = buildLookupMap(faculty, (f) => f.name);
  const facultyById = new Map(faculty.map((f) => [f._id.toString(), f]));
  const roomsByNumber = buildLookupMap(rooms, (r) => r.roomNumber);
  const roomsById = new Map(rooms.map((r) => [r._id.toString(), r]));

  let resolvedSectionId = null;
  const mappedSlots = [];

  slots.forEach((slot, index) => {
    const sectionId = resolveSectionId(slot, sectionIdOverride, sectionsByName);
    if (!resolvedSectionId && sectionId) resolvedSectionId = sectionId;
    if (resolvedSectionId && sectionId && resolvedSectionId !== sectionId) {
      warnings.push(`Row ${index + 1}: Section mismatch. Slot skipped.`);
      return;
    }
    if (!resolvedSectionId && !sectionId) {
      warnings.push(`Row ${index + 1}: Missing section. Slot skipped.`);
      return;
    }

    const day = normalizeDay(slot.day || slot.weekday);
    const time = normalizeTime(slot.time || slot.slot || slot.period);
    if (!day || !VALID_DAYS.includes(day)) {
      warnings.push(`Row ${index + 1}: Invalid day. Slot skipped.`);
      return;
    }
    if (!time) {
      warnings.push(`Row ${index + 1}: Invalid time. Slot skipped.`);
      return;
    }

    const subjectId = resolveSubjectId(slot, subjectsByName);
    const facultyId = resolveFacultyId(slot, facultyByName);
    const roomId = resolveRoomId(slot, roomsByNumber);

    const rawSubject = slot.subjectName || slot.subject || slot.course || slot.paper || null;
    const rawFaculty = slot.facultyName || slot.faculty || slot.teacher || slot.instructor || null;
    const subjectExpanded = rawSubject && subjectAbbrevMap[rawSubject] ? subjectAbbrevMap[rawSubject] : rawSubject;
    const facultyExpanded = rawFaculty && facultyAbbrevMap[rawFaculty] ? facultyAbbrevMap[rawFaculty] : rawFaculty;

    const subjectLabel = subjectId
      ? subjectsById.get(subjectId)?.name
      : subjectExpanded;
    const facultyLabel = facultyId
      ? facultyById.get(facultyId)?.name
      : facultyExpanded;
    const roomLabel = roomId
      ? roomsById.get(roomId)?.roomNumber
      : slot.roomNumber || slot.room || slot.classroom || null;

    if (!subjectId && (slot.subject || slot.subjectName)) {
      warnings.push(`Row ${index + 1}: Subject not found (${slot.subject || slot.subjectName}).`);
    }
    if (!facultyId && (slot.faculty || slot.facultyName)) {
      warnings.push(`Row ${index + 1}: Faculty not found (${slot.faculty || slot.facultyName}).`);
    }
    if (!roomId && (slot.room || slot.roomNumber)) {
      warnings.push(`Row ${index + 1}: Room not found (${slot.room || slot.roomNumber}).`);
    }

    mappedSlots.push({
      day,
      time,
      subjectId: subjectId || null,
      facultyId: facultyId || null,
      roomId: roomId || null,
      subjectLabel,
      facultyLabel,
      roomLabel,
      status: slot.status || "scheduled",
    });
  });

  if (!resolvedSectionId && sectionIdOverride) {
    resolvedSectionId = sectionIdOverride;
  }

  if (!resolvedSectionId) {
    return { sectionId: null, slots: [], warnings, conflicts };
  }

  const combinedSlots = [...existingSlots];

  mappedSlots.forEach((slot, index) => {
    const facultyDoc = slot.facultyId ? facultyById.get(slot.facultyId.toString()) : null;
    const unavailableSlots = facultyDoc ? facultyDoc.unavailableSlots || [] : [];
    const { hasConflict, reason } = checkConflicts(
      combinedSlots,
      {
        day: slot.day,
        time: slot.time,
        facultyId: slot.facultyId,
        roomId: slot.roomId,
        unavailableSlots,
      },
      null
    );
    if (hasConflict) {
      conflicts.push({ index: index + 1, reason });
    }
    combinedSlots.push(slot);
  });

  return { sectionId: resolvedSectionId, slots: mappedSlots, warnings, conflicts };
}

module.exports = {
  mapSlots,
  normalizeDay,
  normalizeTime,
  isObjectId,
};
