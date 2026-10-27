/**
 * seed.js — Seeds the smart-timetable DB with all faculty, subjects,
 *            sections, and rooms from the SE Computer A timetable.
 *
 * IMPORTANT: Faculty names are stored WITHOUT honorifics (no Prof., Dr., Mr.).
 * This ensures a faculty who registers as "Sohan Agate" matches the Faculty
 * doc "Sohan Agate" during login, allowing them to cancel their own seeded slots.
 *
 * Run from /backend:
 *   node seed.js
 *
 * WARNING: This CLEARS existing Faculty, Subject, Section, Room, Timetable docs first.
 */

require("dotenv").config();
const mongoose = require("mongoose");

const Faculty   = require("./models/Faculty");
const Subject   = require("./models/Subject");
const Section   = require("./models/Section");
const Room      = require("./models/Room");
const Timetable = require("./models/Timetable");
const User      = require("./models/User");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set in .env");
  process.exit(1);
}

// ─── Data — names WITHOUT honorifics ─────────────────────────────────────────

const FACULTY_DATA = [
  { abbr: "PVS",  name: "Pradeep Singh"         },
  { abbr: "HP",   name: "Heena Pendhari"         },
  { abbr: "KPD",  name: "Kalpana Deorukhkar"     },
  { abbr: "FJ",   name: "Flynn Jiu"              },
  { abbr: "SRA",  name: "Sohan Agate"            },
  { abbr: "AB",   name: "Astha Bhatia"           },
  { abbr: "GIS",  name: "Gajendra Singh"         },
  { abbr: "KKW",  name: "Kranti Wagale"          },
  { abbr: "AT",   name: "Abhijit Tanksale"       },
  { abbr: "OP",   name: "Onkar Potdar"           },
  { abbr: "DAB",  name: "Dipak Bauskar"          },
  { abbr: "VBR",  name: "M. VeeraBhadra Rao"     },
  { abbr: "GK",   name: "Graham Koyeerath"       },
  { abbr: "PNL",  name: "Prasad Lalit"           },
  { abbr: "SKD",  name: "Sunil K.Das"            },
  { abbr: "MA",   name: "Mayur Agarwal"          },
];

const SUBJECT_DATA = [
  { abbr: "LABS",      name: "Linear Algebra and Business Statistics",        primaryFaculty: "PVS" },
  { abbr: "OS",        name: "Operating Systems",                              primaryFaculty: "FJ"  },
  { abbr: "DBMS",      name: "Database Management Systems",                    primaryFaculty: "HP"  },
  { abbr: "AOA",       name: "Analysis of Algorithm",                          primaryFaculty: "KPD" },
  { abbr: "FSD",       name: "Full Stack Development",                         primaryFaculty: "SRA" },
  { abbr: "ETL",       name: "Emerging Technology and Law",                    primaryFaculty: "DAB" },
  { abbr: "POM",       name: "Principles of Management",                       primaryFaculty: "MA"  },
  { abbr: "TE",        name: "Technology Entrepreneurship",                    primaryFaculty: "MA"  },
  { abbr: "TISD",      name: "Technology Innovation for Sustainable Development", primaryFaculty: "FJ" },
  { abbr: "PCB",       name: "Professional Competency Building",               primaryFaculty: "AB"  },
  { abbr: "MDM",       name: "Double Minor",                                   primaryFaculty: "KKW" },
  { abbr: "MENTOR",    name: "Mentoring",                                      primaryFaculty: "SRA" },
];

const FACULTY_SUBJECT_MAP = {
  PVS: ["LABS"],
  HP:  ["DBMS"],
  KPD: ["AOA"],
  FJ:  ["OS", "TISD"],
  SRA: ["FSD", "OS", "MENTOR"],
  AB:  ["PCB"],
  GIS: ["PCB"],
  KKW: ["MDM"],
  AT:  ["MDM"],
  OP:  ["MDM"],
  DAB: ["ETL"],
  VBR: ["ETL"],
  GK:  ["ETL"],
  PNL: ["LABS"],
  SKD: ["FSD"],
  MA:  ["TE", "POM"],
};

const ROOM_DATA = [
  { roomNumber: "706", capacity: 60 },
  { roomNumber: "701", capacity: 60 },
  { roomNumber: "702", capacity: 60 },
  { roomNumber: "707", capacity: 60 },
  { roomNumber: "301", capacity: 40 },
  { roomNumber: "302", capacity: 40 },
];

const ADMIN_USER = {
  name:     "Admin",
  email:    "admin@crce.edu",
  password: "Admin@1234",
  role:     "admin",
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // 1. Clear existing seeded data
  await Promise.all([
    Faculty.deleteMany({}),
    Subject.deleteMany({}),
    Section.deleteMany({}),
    Room.deleteMany({}),
    Timetable.deleteMany({}),
  ]);
  console.log("🗑  Cleared Faculty, Subject, Section, Room, Timetable");

  // 2. Insert Faculty first (needed as FK in Subject)
  const insertedFaculty = await Faculty.insertMany(
    FACULTY_DATA.map((f) => ({ name: f.name, subjects: [] }))
  );
  const facultyMap = {}; // abbr → { _id, name }
  insertedFaculty.forEach((f, i) => {
    facultyMap[FACULTY_DATA[i].abbr] = { _id: f._id, name: f.name };
  });
  console.log(`👩‍🏫 Inserted ${insertedFaculty.length} faculty members`);

  // 3. Insert Subjects — each linked to a primary faculty
  const insertedSubjects = await Subject.insertMany(
    SUBJECT_DATA.map((s) => ({
      name:      s.name,
      facultyId: facultyMap[s.primaryFaculty]?._id || insertedFaculty[0]._id,
    }))
  );
  const subjectMap = {}; // abbr → ObjectId
  insertedSubjects.forEach((s, i) => {
    subjectMap[SUBJECT_DATA[i].abbr] = s._id;
  });
  console.log(`📚 Inserted ${insertedSubjects.length} subjects`);

  // 4. Update Faculty with their subjects
  for (const [abbr, fData] of Object.entries(facultyMap)) {
    const subjectAbbrs = FACULTY_SUBJECT_MAP[abbr] || [];
    const subjectIds   = subjectAbbrs.map((sa) => subjectMap[sa]).filter(Boolean);
    if (subjectIds.length > 0) {
      await Faculty.findByIdAndUpdate(fData._id, { subjects: subjectIds });
    }
  }
  console.log("🔗 Linked faculty → subjects");

  // 5. Insert Rooms
  const insertedRooms = await Room.insertMany(ROOM_DATA);
  const room706 = insertedRooms.find((r) => r.roomNumber === "706");
  console.log(`🏫 Inserted ${insertedRooms.length} rooms`);

  // 6. Insert Section
  const [section] = await Section.insertMany([
    {
      name:      "SE Computer A",
      semester:  4,
      subjects:  Object.values(subjectMap),
    },
  ]);
  console.log(`📑 Inserted section: ${section.name}`);

  // 7. Build Timetable slots — matches screenshot exactly
  const R = room706?._id;
  const F = (abbr) => facultyMap[abbr]?._id;
  const S = (abbr) => subjectMap[abbr];

  const slots = [
    // ── Monday ──────────────────────────────────────────────────────────────
    { day: "Monday", time: "8:45",  subjectId: S("OS"),   facultyId: F("FJ"),  roomId: R, status: "scheduled" },
    { day: "Monday", time: "9:45",  subjectId: S("DBMS"), facultyId: F("HP"),  roomId: R, status: "scheduled" },
    { day: "Monday", time: "11:00", subjectId: S("LABS"), facultyId: F("PVS"), roomId: R, status: "scheduled" },
    { day: "Monday", time: "12:00", subjectId: S("LABS"), facultyId: F("PVS"), roomId: R, status: "scheduled" },
    { day: "Monday", time: "13:30", subjectId: S("PCB"),  facultyId: F("AB"),  roomId: R, status: "scheduled" },
    { day: "Monday", time: "14:30", subjectId: S("MDM"),  facultyId: F("KKW"), roomId: R, status: "scheduled" },
    { day: "Monday", time: "15:30", subjectId: S("MDM"),  facultyId: F("AT"),  roomId: R, status: "scheduled" },
    // ── Tuesday ─────────────────────────────────────────────────────────────
    { day: "Tuesday", time: "8:45",  subjectId: S("AOA"),  facultyId: F("KPD"), roomId: R, status: "scheduled" },
    { day: "Tuesday", time: "9:45",  subjectId: S("AOA"),  facultyId: F("KPD"), roomId: R, status: "scheduled" },
    { day: "Tuesday", time: "11:00", subjectId: S("FSD"),  facultyId: F("SKD"), roomId: R, status: "scheduled" },
    { day: "Tuesday", time: "12:00", subjectId: S("OS"),   facultyId: F("FJ"),  roomId: R, status: "scheduled" },
    { day: "Tuesday", time: "13:30", subjectId: S("MDM"),  facultyId: F("KKW"), roomId: R, status: "scheduled" },
    { day: "Tuesday", time: "14:30", subjectId: S("TISD"), facultyId: F("FJ"),  roomId: R, status: "scheduled" },
    // ── Wednesday ───────────────────────────────────────────────────────────
    { day: "Wednesday", time: "8:45",  subjectId: S("DBMS"), facultyId: F("HP"),  roomId: R, status: "scheduled" },
    { day: "Wednesday", time: "9:45",  subjectId: S("AOA"),  facultyId: F("KPD"), roomId: R, status: "scheduled" },
    { day: "Wednesday", time: "11:00", subjectId: S("DBMS"), facultyId: F("HP"),  roomId: R, status: "scheduled" },
    { day: "Wednesday", time: "12:00", subjectId: S("FSD"),  facultyId: F("SRA"), roomId: R, status: "scheduled" },
    { day: "Wednesday", time: "13:30", subjectId: S("PCB"),  facultyId: F("GIS"), roomId: R, status: "scheduled" },
    { day: "Wednesday", time: "14:30", subjectId: S("MDM"),  facultyId: F("KKW"), roomId: R, status: "scheduled" },
    { day: "Wednesday", time: "15:30", subjectId: S("MDM"),  facultyId: F("AT"),  roomId: R, status: "scheduled" },
    // ── Thursday ────────────────────────────────────────────────────────────
    { day: "Thursday", time: "8:45",  subjectId: S("LABS"), facultyId: F("PVS"), roomId: R, status: "scheduled" },
    { day: "Thursday", time: "9:45",  subjectId: S("OS"),   facultyId: F("FJ"),  roomId: R, status: "scheduled" },
    { day: "Thursday", time: "11:00", subjectId: S("OS"),   facultyId: F("SRA"), roomId: R, status: "scheduled" },
    { day: "Thursday", time: "12:00", subjectId: S("FSD"),  facultyId: F("SKD"), roomId: R, status: "scheduled" },
    { day: "Thursday", time: "13:30", subjectId: S("TE"),   facultyId: F("MA"),  roomId: R, status: "scheduled" },
    // ── Friday ──────────────────────────────────────────────────────────────
    { day: "Friday", time: "8:45",  subjectId: S("AOA"),  facultyId: F("KPD"), roomId: R, status: "scheduled" },
    { day: "Friday", time: "9:45",  subjectId: S("DBMS"), facultyId: F("HP"),  roomId: R, status: "scheduled" },
    { day: "Friday", time: "11:00", subjectId: S("FSD"),  facultyId: F("SRA"), roomId: R, status: "scheduled" },
    { day: "Friday", time: "12:00", subjectId: S("DBMS"), facultyId: F("HP"),  roomId: R, status: "scheduled" },
    { day: "Friday", time: "13:30", subjectId: S("ETL"),  facultyId: F("DAB"), roomId: R, status: "scheduled" },
    { day: "Friday", time: "14:30", subjectId: S("ETL"),  facultyId: F("VBR"), roomId: R, status: "scheduled" },
    { day: "Friday", time: "15:30", subjectId: S("ETL"),  facultyId: F("GK"),  roomId: R, status: "scheduled" },
    // ── Saturday — Mentoring (11:00–13:00) + MDM-3 (13:30–16:30) ───────────
    { day: "Saturday", time: "11:00", subjectId: S("MENTOR"), facultyId: null, roomId: null, status: "scheduled" },
    { day: "Saturday", time: "12:00", subjectId: S("MENTOR"), facultyId: null, roomId: null, status: "scheduled" },
    { day: "Saturday", time: "13:30", subjectId: S("MDM"),    facultyId: null, roomId: null, status: "scheduled" },
    { day: "Saturday", time: "14:30", subjectId: S("MDM"),    facultyId: null, roomId: null, status: "scheduled" },
    { day: "Saturday", time: "15:30", subjectId: S("MDM"),    facultyId: null, roomId: null, status: "scheduled" },
  ];

  await Timetable.create({ sectionId: section._id, slots });
  console.log(`📅 Inserted timetable with ${slots.length} slots`);

  // 8. Ensure admin user exists
  const existingAdmin = await User.findOne({ email: ADMIN_USER.email });
  if (!existingAdmin) {
    const adminUser = new User(ADMIN_USER);
    await adminUser.save();
    console.log(`👤 Created admin user: ${ADMIN_USER.email}`);
  } else {
    console.log(`👤 Admin already exists: ${ADMIN_USER.email}`);
  }

  console.log("\n✅ Seed complete!");
  console.log(`   Login email:    ${ADMIN_USER.email}`);
  console.log(`   Login password: ${ADMIN_USER.password}`);
  console.log(`   Role:           admin\n`);
  console.log("⚠️  Faculty accounts must be re-registered or re-logged-in after re-seeding.");
  console.log("   Faculty names in seed are now WITHOUT honorifics (e.g. 'Sohan Agate').");
  console.log("   Register/login with the CLEAN name (e.g. 'Sohan Agate') to match correctly.\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
