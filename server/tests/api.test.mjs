import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";


const prefix = randomUUID().slice(0, 8);
let tokenA;
let tokenB;
let userA;
let userB;
let readingId;

const date = "2026-10-15";

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  for (const [suffix, name] of [["a", "Patient A"], ["b", "Patient B"]]) {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name,
        email: `${prefix}-${suffix}@example.com`,
        password: "TestPass123!",
      });

    expect(response.status).toBe(201);

    if (suffix === "a") {
      tokenA = response.body.token;
      userA = response.body.user.id;
    } else {
      tokenB = response.body.token;
      userB = response.body.user.id;
    }
  }
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { id: { in: [userA, userB].filter(Boolean) } },
  });
  await prisma.$disconnect();
});

describe("Authentication", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/readings");
    expect(res.status).toBe(401);
  });

  it("rejects an incorrect password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: `${prefix}-a@example.com`,
        password: "WrongPassword",
      });

    expect(res.status).toBe(401);
  });

  it("does not expose password hashes", async () => {
    const res = await request(app)
      .get("/api/me")
      .set(auth(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.user.passwordHash).toBeUndefined();
  });
});

describe("Reading validation and CRUD", () => {
  it("rejects a missing value", async () => {
    const res = await request(app)
      .post("/api/readings")
      .set(auth(tokenA))
      .send({ date, slot: "MORNING" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/enter a glucose value/i);
  });

  it("rejects an out-of-range value", async () => {
    const res = await request(app)
      .post("/api/readings")
      .set(auth(tokenA))
      .send({ date, slot: "MORNING", value: 700 });

    expect(res.status).toBe(400);
  });

  it("rejects future dates", async () => {
    const res = await request(app)
      .post("/api/readings")
      .set(auth(tokenA))
      .send({
        date: "2099-01-01",
        slot: "MORNING",
        value: 100,
      });

    expect(res.status).toBe(400);
  });

  it("creates a valid reading", async () => {
    const res = await request(app)
      .post("/api/readings")
      .set(auth(tokenA))
      .send({ date, slot: "MORNING", value: 100 });

    expect(res.status).toBe(201);
    expect(res.body.reading.value).toBe(100);
    readingId = res.body.reading.id;
  });

  it("rejects duplicate slots", async () => {
    const res = await request(app)
      .post("/api/readings")
      .set(auth(tokenA))
      .send({ date, slot: "MORNING", value: 120 });

    expect(res.status).toBe(409);
  });

  it("prevents another user from viewing a reading", async () => {
    const res = await request(app)
      .get(`/api/readings/${readingId}`)
      .set(auth(tokenB));

    expect(res.status).toBe(404);
  });

  it("prevents another user from editing a reading", async () => {
    const res = await request(app)
      .put(`/api/readings/${readingId}`)
      .set(auth(tokenB))
      .send({ date, slot: "MORNING", value: 150 });

    expect(res.status).toBe(404);
  });

  it("prevents another user from deleting a reading", async () => {
    const res = await request(app)
      .delete(`/api/readings/${readingId}`)
      .set(auth(tokenB));

    expect(res.status).toBe(404);
  });

  it("updates the owner's reading", async () => {
    const res = await request(app)
      .put(`/api/readings/${readingId}`)
      .set(auth(tokenA))
      .send({ date, slot: "MORNING", value: 110 });

    expect(res.status).toBe(200);
    expect(res.body.reading.value).toBe(110);
  });
});

describe("Reports", () => {
  it("calculates daily statistics correctly", async () => {
    await request(app)
      .post("/api/readings")
      .set(auth(tokenA))
      .send({ date, slot: "AFTER_LUNCH", value: 140 });

    const res = await request(app)
      .get(`/api/reports/daily?date=${date}`)
      .set(auth(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.highest).toBe(140);
    expect(res.body.lowest).toBe(110);
    expect(res.body.average).toBe(125);
    expect(res.body.readings).toHaveLength(2);
  });

  it("returns an empty report for another user", async () => {
    const res = await request(app)
      .get(`/api/reports/daily?date=${date}`)
      .set(auth(tokenB));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.average).toBeNull();
  });

  it("calculates month-to-date correctly", async () => {
    const res = await request(app)
      .get(`/api/reports/mtd?date=${date}`)
      .set(auth(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.startDate).toBe("2026-10-01");
    expect(res.body.count).toBe(2);
  });

  it("returns the correct previous-month range", async () => {
    const res = await request(app)
      .get("/api/reports/monthly?date=2026-11-15")
      .set(auth(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.startDate).toBe("2026-10-01");
    expect(res.body.endDate).toBe("2026-10-31");
    expect(res.body.count).toBe(2);
  });
});

describe("Additional edge cases", () => {
  const edgeDate = "2026-09-10";

  it.each([40, 600])("accepts boundary value %i", async (value) => {
    const slot = value === 40 ? "MORNING" : "AFTER_BREAKFAST";

    const res = await request(app)
      .post("/api/readings")
      .set(auth(tokenA))
      .send({ date: edgeDate, slot, value });

    expect(res.status).toBe(201);
  });

  it.each([39, 601, 110.5])("rejects invalid value %i", async (value) => {
    const res = await request(app)
      .post("/api/readings")
      .set(auth(tokenA))
      .send({ date: edgeDate, slot: "AFTER_LUNCH", value });

    expect(res.status).toBe(400);
  });

  it("prevents duplicate slots during updates", async () => {
    const existing = await request(app)
      .get("/api/readings")
      .set(auth(tokenA));

    const morning = existing.body.readings.find(
      (r) =>
        r.date.slice(0, 10) === edgeDate &&
        r.slot === "MORNING"
    );

    const breakfast = existing.body.readings.find(
      (r) =>
        r.date.slice(0, 10) === edgeDate &&
        r.slot === "AFTER_BREAKFAST"
    );

    const res = await request(app)
      .put(`/api/readings/${breakfast.id}`)
      .set(auth(tokenA))
      .send({
        date: edgeDate,
        slot: morning.slot,
        value: 120,
      });

    expect(res.status).toBe(409);
  });

  it("deletes a reading successfully", async () => {
    const created = await request(app)
      .post("/api/readings")
      .set(auth(tokenA))
      .send({
        date: edgeDate,
        slot: "AFTER_DINNER",
        value: 115,
      });

    expect(created.status).toBe(201);

    const deleted = await request(app)
      .delete(`/api/readings/${created.body.reading.id}`)
      .set(auth(tokenA));

    expect(deleted.status).toBe(200);

    const fetched = await request(app)
      .get(`/api/readings/${created.body.reading.id}`)
      .set(auth(tokenA));

    expect(fetched.status).toBe(404);
  });
});
