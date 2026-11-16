
const express = require("express");
const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const SLOTS = [
  "MORNING",
  "AFTER_BREAKFAST",
  "AFTER_LUNCH",
  "AFTER_DINNER",
];

const SLOT_LABELS = {
  MORNING: "Morning (fasting)",
  AFTER_BREAKFAST: "After breakfast",
  AFTER_LUNCH: "After lunch",
  AFTER_DINNER: "After dinner",
};

function parseDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

function validateReading(body) {
  if (!body || typeof body !== "object" ||
      Array.isArray(body)) {
    return { error: "Invalid reading data." };
  }

  const { date, slot, value } = body;

  if (value === undefined || value === null || value === "") {
    return { error: "Please enter a glucose value." };
  }

  if (!Number.isInteger(value) || value < 40 || value > 600) {
    return { error: "Value must be between 40 and 600 mg/dl." };
  }

  const parsedDate = parseDate(date);

  if (!parsedDate) {
    return { error: "Please enter a valid date." };
  }

  // Compare calendar dates in UTC to avoid timezone shifts.
  const today = new Date().toISOString().slice(0, 10);

  if (date > today) {
    return { error: "Date cannot be in the future." };
  }

  if (!SLOTS.includes(slot)) {
    return { error: "Please select a valid time slot." };
  }

  return { date: parsedDate, slot, value };
}

function handleError(error, res) {
  if (error.code === "P2002") {
    return res.status(409).json({
      message: "You already have a reading for this slot and date.",
    });
  }

  console.error("Reading API error:", error);

  return res.status(500).json({
    message: "Something went wrong. Please try again.",
  });
}

// GET all readings for the authenticated user
router.get("/", async (req, res) => {
  try {
    const readings = await prisma.reading.findMany({
      where: { userId: req.userId },
      orderBy: [
        { date: "desc" },
        { slot: "asc" },
      ],
    });

    res.json({ readings });
  } catch (error) {
    handleError(error, res);
  }
});

// GET one reading
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid reading ID." });
  }

  try {
    const reading = await prisma.reading.findFirst({
      where: { id, userId: req.userId },
    });

    if (!reading) {
      return res.status(404).json({
        message: "Reading not found.",
      });
    }

    res.json({ reading });
  } catch (error) {
    handleError(error, res);
  }
});

// POST create reading
router.post("/", async (req, res) => {
  const data = validateReading(req.body);

  if (data.error) {
    return res.status(400).json({ message: data.error });
  }

  try {
    const existing = await prisma.reading.findUnique({
      where: {
        userId_date_slot: {
          userId: req.userId,
          date: data.date,
          slot: data.slot,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        message: `You already have an ${SLOT_LABELS[data.slot]} reading for this date.`,
      });
    }

    const count = await prisma.reading.count({
      where: { userId: req.userId, date: data.date },
    });

    if (count >= 4) {
      return res.status(400).json({
        message: "You can add only 4 readings per day.",
      });
    }

    const reading = await prisma.reading.create({
      data: {
        userId: req.userId,
        date: data.date,
        slot: data.slot,
        value: data.value,
      },
    });

    res.status(201).json({
      message: "Reading added successfully.",
      reading,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// PUT update reading
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid reading ID." });
  }

  const data = validateReading(req.body);

  if (data.error) {
    return res.status(400).json({ message: data.error });
  }

  try {
    const existing = await prisma.reading.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({
        message: "Reading not found.",
      });
    }

    const duplicate = await prisma.reading.findFirst({
      where: {
        userId: req.userId,
        date: data.date,
        slot: data.slot,
        id: { not: id },
      },
    });

    if (duplicate) {
      return res.status(409).json({
        message: `You already have an ${SLOT_LABELS[data.slot]} reading for this date.`,
      });
    }

    if (existing.date.getTime() !== data.date.getTime()) {
      const count = await prisma.reading.count({
        where: { userId: req.userId, date: data.date },
      });

      if (count >= 4) {
        return res.status(400).json({
          message: "You can add only 4 readings per day.",
        });
      }
    }

    const result = await prisma.reading.updateMany({
      where: { id, userId: req.userId },
      data: {
        date: data.date,
        slot: data.slot,
        value: data.value,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({
        message: "Reading not found.",
      });
    }

    const reading = await prisma.reading.findFirst({
      where: { id, userId: req.userId },
    });

    res.json({
      message: "Reading updated successfully.",
      reading,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// DELETE reading
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "Invalid reading ID." });
  }

  try {
    const result = await prisma.reading.deleteMany({
      where: { id, userId: req.userId },
    });

    if (result.count === 0) {
      return res.status(404).json({
        message: "Reading not found.",
      });
    }

    res.json({ message: "Reading deleted successfully." });
  } catch (error) {
    handleError(error, res);
  }
});

module.exports = router;
