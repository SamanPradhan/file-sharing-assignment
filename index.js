require("dotenv").config();
const express = require("express");
const { connectDB } = require("./config/db.config");
const userRoutes = require("./routes/user.routes");

const app = express();
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
  res.send("home route");
});

app.use("/users", userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
