const express = require("express");
const {
  register,
  login,
  uploadFile,
  downloadFile,
  listFiles,
  verifyEmail,
  serveFile,
} = require("../controllers/user.controller");
const { authMiddleware, opsOnly } = require("../middlewares/auth.middleware");
const router = express.Router();

router.post("/signup", register);
router.post("/login", login);
router.get("/verify/:token", verifyEmail);

// Ops-only file upload
router.post("/files/upload", authMiddleware, opsOnly, uploadFile);

// Client actions
router.get("/files/download/:fileId", authMiddleware, downloadFile);
router.get("/files/download-link/:downloadToken", authMiddleware, serveFile);
router.get("/files/list", authMiddleware, listFiles);

module.exports = router;
