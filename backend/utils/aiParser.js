const { genkit } = require("genkit");
const { googleAI } = require("@genkit-ai/google-genai");

const ai = genkit({ plugins: [googleAI()] });

function extractJsonBlock(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  const bracketed = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return bracketed ? bracketed[1] : text;
}

async function extractSlotsFromText(rawText) {
  const prompt = `
You are a data extraction assistant. Convert the provided timetable text into JSON.

Return ONLY valid JSON with this shape:
{
  "slots": [
    { "day": "Monday", "time": "9:00", "subject": "...", "faculty": "...", "room": "...", "section": "..." }
  ],
  "subjectAbbrevMap": { "DBMS": "Database Management Systems" },
  "facultyAbbrevMap": { "FJ": "Prof. Flynn Jiu" }
}

Rules:
- Skip empty/free/break cells.
- Day must be Monday, Tuesday, Wednesday, Thursday, Friday, Saturday.
- Time should be in H:MM 24-hour format (e.g., 8:45, 13:30).
- If section name appears in the document header, include it as "section" on each slot.
- If the document has subject/faculty abbreviation tables, fill subjectAbbrevMap/facultyAbbrevMap.
- Use abbreviation maps to expand subject/faculty names when possible.
- If any field is missing, omit that field.
- Do not include explanations or extra text.

Timetable text:
${rawText}
  `.trim();

  const response = await ai.generate({
    model: googleAI.model("gemini-3-flash-preview"),
    prompt,
  });

  const raw = response?.text || "";
  const jsonText = extractJsonBlock(raw);
  return JSON.parse(jsonText);
}

module.exports = { extractSlotsFromText };
