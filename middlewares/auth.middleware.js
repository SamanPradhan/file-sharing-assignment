const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const authMiddleware = (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token found." });
  }
  console.log(token);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log(req.user);
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

const opsOnly = (req, res, next) => {
  if (req.user.role !== "ops") {
    return res
      .status(403)
      .json({ message: "Forbidden: Only ops users can upload files" });
  }
  next();
};

module.exports = { authMiddleware, opsOnly };
