
const express = require("express");
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

function parseDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

function getSelectedDate(req, res) {
  const dateString = req.query.date;

  if (!dateString) {
    res.status(400).json({
      message: "Please select a date.",
    });
    return null;
  }

  const date = parseDate(dateString);

  if (!date) {
    res.status(400).json({
      message: "Please enter a valid date.",
    });
    return null;
  }

  return date;
}

function formatStats(result) {
  return {
    highest: result._max.value,
    lowest: result._min.value,
    average:
      result._avg.value === null
        ? null
        : Math.round(result._avg.value * 10) / 10,
    count: result._count.value,
  };
}

async function calculateStats(userId, start, end) {
  const result = await prisma.reading.aggregate({
    where: {
      userId,
      date: {
        gte: start,
        lt: end,
      },
    },
    _max: { value: true },
    _min: { value: true },
    _avg: { value: true },
    _count: { value: true },
  });

  return formatStats(result);
}

// DAILY REPORT
router.get("/daily", async (req, res) => {
  const date = getSelectedDate(req, res);
  if (!date) return;

  try {
    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 1);

    const [stats, readings] = await Promise.all([
      calculateStats(req.userId, date, end),
      prisma.reading.findMany({
        where: {
          userId: req.userId,
          date,
        },
        orderBy: { slot: "asc" },
      }),
    ]);

    res.json({
      report: "daily",
      date: req.query.date,
      ...stats,
      readings,
    });
  } catch (error) {
    console.error("Daily report error:", error);
    res.status(500).json({
      message: "Unable to generate daily report.",
    });
  }
});

// MONTH-TO-DATE REPORT
router.get("/mtd", async (req, res) => {
  const date = getSelectedDate(req, res);
  if (!date) return;

  try {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
    );

    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 1);

    const stats = await calculateStats(req.userId, start, end);

    res.json({
      report: "month-to-date",
      startDate: start.toISOString().slice(0, 10),
      endDate: req.query.date,
      ...stats,
    });
  } catch (error) {
    console.error("MTD report error:", error);
    res.status(500).json({
      message: "Unable to generate month-to-date report.",
    });
  }
});

// PREVIOUS MONTH REPORT
router.get("/monthly", async (req, res) => {
  const date = getSelectedDate(req, res);
  if (!date) return;

  try {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const stats = await calculateStats(req.userId, start, end);

    const lastDay = new Date(end.getTime() - 86400000);

    res.json({
      report: "monthly",
      startDate: start.toISOString().slice(0, 10),
      endDate: lastDay.toISOString().slice(0, 10),
      ...stats,
    });
  } catch (error) {
    console.error("Monthly report error:", error);
    res.status(500).json({
      message: "Unable to generate monthly report.",
    });
  }
});

module.exports = router;
