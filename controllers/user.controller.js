const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const multer = require("multer");

const path = require("path");

const nodemailer = require("nodemailer");
const fs = require("fs");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /pptx|docx|xlsx/;

  // Allowed MIME types
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  ];

  // Check file extension
  const extname = allowedExtensions.test(file.originalname.split(".").pop());
  const mimeType = allowedMimeTypes.includes(file.mimetype);

  if (extname && mimeType) {
    cb(null, true);
  } else {
    // If not valid, return an error
    cb(
      new Error(
        "Wrong format of file. Only .pptx, .docx, .xlsx files are allowed!"
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("file");

const sendVerificationEmail = async (email, token) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const verificationURL = `${process.env.BASE_URL}/users/verify/${token}`;

  const mailOptions = {
    from: '"Your App" <no-reply@yourapp.com>',
    to: email,
    subject: "Email Verification",
    text: `Please verify your email by clicking the following link: ${verificationURL}`,
    html: `<p>Please verify your email by clicking the following link: <a href="${verificationURL}">${verificationURL}</a></p>`,
  };

  await transporter.sendMail(mailOptions);
};

const verifyEmail = async (req, res) => {
  try {
    const token = req.params.token;

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "User already verified." });
    }

    user.isVerified = true;
    await user.save();

    res.status(200).json({ message: "Email verified successfully." });
  } catch (error) {
    res.status(400).json({ error });
  }
};

const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists." });
    }

    const newUser = new User({
      username,
      email,
      password,
      role,
      isVerified: false,
    });

    await newUser.save();

    const token = jwt.sign({ email: newUser.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    await sendVerificationEmail(newUser.email, token);
    res.status(201).json({
      message:
        "User registered successfully. Please verify your email by checking inbox.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isVerified) {
      return res
        .status(401)
        .json({ message: "Please verify your email before logging in" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const uploadFile = (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Please upload a file" });
    }

    try {
      console.log(req.file);
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(user.file);
      user.files.push(req.file.path);
      await user.save();

      res
        .status(200)
        .json({ message: "File uploaded successfully", file: req.file.path });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
};

const generateDownloadToken = (fileId, userId) => {
  return jwt.sign({ fileId, userId }, JWT_SECRET, { expiresIn: "1h" });
};

const decodeDownloadToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

const downloadFile = (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    if (userRole !== "client") {
      return res.status(403).json({
        message: "Access denied. Only client users can download files.",
      });
    }

    const fileId = req.params.fileId;

    const downloadToken = generateDownloadToken(fileId, userId);

    res.status(200).json({
      downloadLink: `${process.env.BASE_URL}/users/files/download-link/${downloadToken}`,
      message: "lisk shared success",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

const serveFile = (req, res) => {
  try {
    const userRole = req.user.role;
    if (userRole !== "client") {
      return res.status(403).json({
        message: "Access denied. Only client users can download files",
      });
    }
    const downloadToken = req.params.downloadToken;
    const userId = req.user.userId;
    const decodedToken = decodeDownloadToken(downloadToken);

    console.log(downloadToken);
    const fileId = decodedToken.fileId;
    const deCodedUserId = decodedToken.userId;
    console.log(userId, deCodedUserId);
    if (deCodedUserId !== userId) {
      return res.status(403).json({
        message: "Access denied. You don't have access",
      });
    }

    const filePath = path.join(__dirname, "../uploads/", fileId);

    res.download(filePath, (err, success) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Error downloading file.", error: err });
      }
      if (success) {
        return res.status(500).json({ message: "downloaded file." });
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.listFiles = (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole !== "client") {
      return res
        .status(403)
        .json({ message: "Access denied. Only client users can list files." });
    }

    const directoryPath = path.join(__dirname, "../uploads/");

    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Unable to list files.", error: err });
      }

      res.status(200).json({
        files,
      });
    });
  } catch (error) {
    res.status(400).json({ error });
  }
};

module.exports = {
  register,
  login,
  uploadFile,
  downloadFile,
  listFiles,
  verifyEmail,
  serveFile,
};
