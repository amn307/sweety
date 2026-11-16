
const express = require("express");
const cors = require("cors");
const prisma = require("./lib/prisma");
const authRoutes = require("./routes/auth");
const readingRoutes = require("./routes/readings");
const reportRoutes = require("./routes/reports");
const authenticate = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "20kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/readings", readingRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      message: "Sweety API is running",
      database: "connected",
    });
  } catch {
    res.status(503).json({
      message: "Database unavailable",
    });
  }
});

app.get("/api/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return res.status(401).json({
        message: "User no longer exists.",
      });
    }

    res.json({ user });
  } catch {
    res.status(500).json({
      message: "Unable to retrieve user.",
    });
  }
});

module.exports = app;
