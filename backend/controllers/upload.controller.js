const crypto = require("crypto");
const Timetable = require("../models/Timetable");
const Section = require("../models/Section");
const Subject = require("../models/Subject");
const Faculty = require("../models/Faculty");
const Room = require("../models/Room");
const { parseJsonInput, parseFromUrl, extractTextFromFile } = require("../utils/fileParser");
const { extractSlotsFromText } = require("../utils/aiParser");
const { mapSlots } = require("../utils/timetableMapper");
const { getIO } = require("../socket/socketHandler");

const CACHE_TTL_MS = 30 * 60 * 1000;
const uploadCache = new Map();

function safeEmit(event, room, payload) {
  try {
    getIO().to(room).emit(event, payload);
  } catch (e) {
    console.warn(`[Socket] emit failed (${event}):`, e.message);
  }
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of uploadCache.entries()) {
    if (now - value.createdAt > CACHE_TTL_MS) {
      uploadCache.delete(key);
    }
  }
}

function putCache(payload) {
  cleanupCache();
  const uploadId = crypto.randomBytes(12).toString("hex");
  uploadCache.set(uploadId, { ...payload, createdAt: Date.now() });
  return uploadId;
}

function getCached(uploadId) {
  cleanupCache();
  return uploadCache.get(uploadId);
}

async function buildPreview({ slots, sectionIdOverride, subjectAbbrevMap, facultyAbbrevMap }) {
  const [sections, subjects, faculty, rooms, timetables] = await Promise.all([
    Section.find({}).lean(),
    Subject.find({}).lean(),
    Faculty.find({}).lean(),
    Room.find({}).lean(),
    Timetable.find({}).lean(),
  ]);

  const existingSlots = timetables.flatMap((tt) => tt.slots || []);

  return mapSlots({
    slots,
    sectionIdOverride,
    subjectAbbrevMap,
    facultyAbbrevMap,
    sections,
    subjects,
    faculty,
    rooms,
    existingSlots,
  });
}

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function ensureFacultyByName(name, cache) {
  if (!name) return null;
  const key = name.toLowerCase();
  if (cache.facultyByName.has(key)) return cache.facultyByName.get(key);
  const existing = await Faculty.findOne({ name: new RegExp(`^${escapeRegExp(name)}$`, "i") }).lean();
  if (existing) {
    cache.facultyByName.set(key, existing);
    return existing;
  }
  const created = await Faculty.create({ name });
  const createdDoc = created.toObject();
  cache.facultyByName.set(key, createdDoc);
  cache.created.faculty.push(createdDoc.name);
  return createdDoc;
}

async function ensureRoomByNumber(roomNumber, cache) {
  if (!roomNumber) return null;
  const key = roomNumber.toLowerCase();
  if (cache.roomsByNumber.has(key)) return cache.roomsByNumber.get(key);
  const existing = await Room.findOne({ roomNumber: new RegExp(`^${escapeRegExp(roomNumber)}$`, "i") }).lean();
  if (existing) {
    cache.roomsByNumber.set(key, existing);
    return existing;
  }
  const created = await Room.create({ roomNumber, capacity: 60 });
  const createdDoc = created.toObject();
  cache.roomsByNumber.set(key, createdDoc);
  cache.created.rooms.push(createdDoc.roomNumber);
  return createdDoc;
}

async function ensureSubjectByName(name, facultyId, cache) {
  if (!name) return null;
  const key = name.toLowerCase();
  if (cache.subjectsByName.has(key)) return cache.subjectsByName.get(key);
  const existing = await Subject.findOne({ name: new RegExp(`^${escapeRegExp(name)}$`, "i") }).lean();
  if (existing) {
    cache.subjectsByName.set(key, existing);
    if (facultyId) {
      await Faculty.findByIdAndUpdate(facultyId, { $addToSet: { subjects: existing._id } });
    }
    return existing;
  }
  if (!facultyId) return null;
  const created = await Subject.create({ name, facultyId });
  const createdDoc = created.toObject();
  cache.subjectsByName.set(key, createdDoc);
  await Faculty.findByIdAndUpdate(facultyId, { $addToSet: { subjects: createdDoc._id } });
  cache.created.subjects.push(createdDoc.name);
  return createdDoc;
}

async function uploadTimetable(req, res) {
  try {
    const { url, json, sectionId } = req.body;
    let parsed = null;
    let rawText = null;

    if (req.file) {
      const isJsonFile =
        req.file.mimetype === "application/json" ||
        req.file.originalname?.toLowerCase().endsWith(".json");
      if (isJsonFile) {
        parsed = await parseJsonInput(req.file.buffer.toString("utf8"));
      } else {
        rawText = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
      }
    } else if (url) {
      parsed = await parseFromUrl(url);
    } else if (json) {
      parsed = await parseJsonInput(json);
    } else if (req.body?.slots) {
      parsed = await parseJsonInput(req.body);
    } else {
      return res.status(400).json({ success: false, message: "Upload a file, provide JSON, or specify a URL." });
    }

    if (!parsed && rawText) {
      parsed = await extractSlotsFromText(rawText);
    }

    if (parsed && parsed.text && !parsed.slots) {
      parsed = await extractSlotsFromText(parsed.text);
    }

    const normalized = Array.isArray(parsed?.slots) ? parsed : { slots: parsed?.slots || [] };
    const preview = await buildPreview({
      slots: normalized.slots || [],
      sectionIdOverride: sectionId || normalized.sectionId || null,
      subjectAbbrevMap: parsed?.subjectAbbrevMap || {},
      facultyAbbrevMap: parsed?.facultyAbbrevMap || {},
    });

    if (!preview.sectionId) {
      return res.status(400).json({
        success: false,
        message: "Section could not be resolved. Provide a section in the file or select one in the UI.",
      });
    }

    const uploadId = putCache({
      sectionId: preview.sectionId,
      slots: preview.slots,
      warnings: preview.warnings,
      conflicts: preview.conflicts,
    });

    return res.status(200).json({
      success: true,
      uploadId,
      preview: {
        sectionId: preview.sectionId,
        slotCount: preview.slots.length,
        warnings: preview.warnings,
        conflicts: preview.conflicts,
        slots: preview.slots,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function confirmUpload(req, res) {
  try {
    const { uploadId, sectionId, strategy } = req.body;
    if (!uploadId) {
      return res.status(400).json({ success: false, message: "uploadId is required" });
    }

    const cached = getCached(uploadId);
    if (!cached) {
      return res.status(404).json({
        success: false,
        message: "Upload preview expired or server restarted. Please re-upload.",
      });
    }

    const targetSectionId = sectionId || cached.sectionId;
    if (!targetSectionId) {
      return res.status(400).json({ success: false, message: "sectionId is required" });
    }

    const existing = await Timetable.findOne({ sectionId: targetSectionId }).lean();
    const existingSlots = existing?.slots || [];

    const cache = {
      facultyByName: new Map(),
      subjectsByName: new Map(),
      roomsByNumber: new Map(),
      created: { faculty: [], subjects: [], rooms: [] },
    };

    for (const slot of cached.slots) {
      const facultyLabel = slot.facultyLabel || null;
      const subjectLabel = slot.subjectLabel || null;
      const roomLabel = slot.roomLabel || null;

      if (!slot.facultyId && facultyLabel) {
        const facultyDoc = await ensureFacultyByName(facultyLabel, cache);
        if (facultyDoc) slot.facultyId = facultyDoc._id.toString();
      }

      if (!slot.roomId && roomLabel) {
        const roomDoc = await ensureRoomByNumber(roomLabel, cache);
        if (roomDoc) slot.roomId = roomDoc._id.toString();
      }

      if (!slot.subjectId && subjectLabel) {
        const subjectDoc = await ensureSubjectByName(subjectLabel, slot.facultyId, cache);
        if (subjectDoc) slot.subjectId = subjectDoc._id.toString();
      }
    }

    let nextSlots = [];
    if (strategy === "replace") {
      nextSlots = cached.slots;
    } else {
      const slotMap = new Map(existingSlots.map((slot) => [`${slot.day}|${slot.time}`, slot]));
      cached.slots.forEach((slot) => {
        const key = `${slot.day}|${slot.time}`;
        if (!slotMap.has(key)) {
          slotMap.set(key, slot);
          return;
        }

        const current = slotMap.get(key);
        const currentEmpty = !current.subjectId && !current.facultyId && !current.roomId;
        const incomingHasData = slot.subjectId || slot.facultyId || slot.roomId;

        if (currentEmpty && incomingHasData) {
          slotMap.set(key, slot);
        }
      });
      nextSlots = Array.from(slotMap.values());
    }

    const updated = await Timetable.findOneAndUpdate(
      { sectionId: targetSectionId },
      {
        sectionId: targetSectionId,
        slots: nextSlots.map((slot) => {
          const { subjectLabel, facultyLabel, roomLabel, ...rest } = slot;
          return {
            ...rest,
            lastUpdatedBy: req.user.id,
            lastUpdatedAt: new Date(),
          };
        }),
      },
      { new: true, upsert: true, runValidators: true }
    );

    uploadCache.delete(uploadId);

    safeEmit("timetable-updated", `section-${targetSectionId}`, {
      sectionId: targetSectionId,
      changedSlot: null,
    });

    return res.status(200).json({
      success: true,
      data: updated,
      created: cache.created,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getUploadPreview(req, res) {
  const cached = getCached(req.params.uploadId);
  if (!cached) {
    return res.status(404).json({ success: false, message: "Upload preview not found" });
  }
  return res.status(200).json({
    success: true,
    data: {
      sectionId: cached.sectionId,
      slots: cached.slots,
      warnings: cached.warnings,
      conflicts: cached.conflicts,
    },
  });
}

async function deleteUploadPreview(req, res) {
  uploadCache.delete(req.params.uploadId);
  return res.status(200).json({ success: true });
}

module.exports = {
  uploadTimetable,
  confirmUpload,
  getUploadPreview,
  deleteUploadPreview,
};
