const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const authorize = require("../middleware/role");
const upload = require("../middleware/upload");
const {
  uploadTimetable,
  confirmUpload,
  getUploadPreview,
  deleteUploadPreview,
} = require("../controllers/upload.controller");

router.use(verifyToken);

router.post("/upload", authorize(["admin"]), upload.single("file"), uploadTimetable);
router.post("/confirm-upload", authorize(["admin"]), confirmUpload);
router.get("/upload/:uploadId", authorize(["admin"]), getUploadPreview);
router.delete("/upload/:uploadId", authorize(["admin"]), deleteUploadPreview);

module.exports = router;
