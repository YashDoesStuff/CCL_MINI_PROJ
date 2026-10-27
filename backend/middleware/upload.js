const multer = require("multer");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/json",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

function fileFilter(req, file, cb) {
  const isAllowed = allowedMimeTypes.has(file.mimetype);
  if (!isAllowed) {
    return cb(new Error("Unsupported file type. Upload PDF, DOCX, XLSX, JSON, or image."));
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

module.exports = upload;
