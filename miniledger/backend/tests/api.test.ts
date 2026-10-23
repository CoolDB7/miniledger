import request from "supertest";

// Point at a separate test database BEFORE importing the app
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://miniledger:miniledger@localhost:5432/miniledger_test";
process.env.JWT_SECRET = "test-secret";

import { app } from "../src/app";
import { pool } from "../src/db";
import { migrate } from "../src/migrate";

const PHONE = "+919876543210";
let token = "";

async function latestOtp(phone: string): Promise<string> {
  const { rows } = await pool.query("SELECT code FROM otps WHERE phone=$1 ORDER BY id DESC LIMIT 1", [phone]);
  return rows[0].code;
}

async function login(phone: string): Promise<string> {
  await request(app).post("/auth/request-otp").send({ phone }).expect(200);
  const res = await request(app).post("/auth/verify-otp").send({ phone, otp: await latestOtp(phone) }).expect(200);
  return res.body.token;
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

beforeAll(async () => {
  await migrate();
  await pool.query("TRUNCATE loans, otps, users RESTART IDENTITY CASCADE");
  token = await login(PHONE);
});
afterAll(() => pool.end());

describe("auth", () => {
  it("rejects invalid phone", async () => {
    await request(app).post("/auth/request-otp").send({ phone: "abc" }).expect(400);
  });
  it("rejects malformed and wrong OTPs", async () => {
    await request(app).post("/auth/request-otp").send({ phone: PHONE }).expect(200);
    await request(app).post("/auth/verify-otp").send({ phone: PHONE, otp: "12ab" }).expect(400);
    await request(app).post("/auth/verify-otp").send({ phone: PHONE, otp: "000000" }).expect(401);
  });
  it("OTP is single-use", async () => {
    await request(app).post("/auth/request-otp").send({ phone: PHONE });
    const code = await latestOtp(PHONE);
    await request(app).post("/auth/verify-otp").send({ phone: PHONE, otp: code }).expect(200);
    await request(app).post("/auth/verify-otp").send({ phone: PHONE, otp: code }).expect(401);
  });
  it("blocks loans without a token", async () => {
    await request(app).get("/loans").expect(401);
  });
});

describe("loans + summary", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("validates input", async () => {
    await request(app).post("/loans").set(auth()).send({ friend_name: "", amount: 10, due_date: daysFromNow(5) }).expect(400);
    await request(app).post("/loans").set(auth()).send({ friend_name: "A", amount: -5, due_date: daysFromNow(5) }).expect(400);
    await request(app).post("/loans").set(auth()).send({ friend_name: "A", amount: 5, due_date: "5/10/2026" }).expect(400);
  });

  it("computes summary and handles repayment", async () => {
    const overdue = await request(app).post("/loans").set(auth())
      .send({ friend_name: "Rahul", amount: 500, due_date: daysFromNow(-3) }).expect(201);
    expect(overdue.body.is_overdue).toBe(true);
    const upcoming = await request(app).post("/loans").set(auth())
      .send({ friend_name: "Priya", amount: 300.5, due_date: daysFromNow(10) }).expect(201);
    expect(upcoming.body.is_overdue).toBe(false);

    let s = (await request(app).get("/summary").set(auth()).expect(200)).body;
    expect(s).toMatchObject({ total_lent: 800.5, total_repaid: 0, overdue_amount: 500 });

    await request(app).patch(`/loans/${overdue.body.id}/repay`).set(auth()).expect(200);
    await request(app).patch(`/loans/${overdue.body.id}/repay`).set(auth()).expect(409);
    await request(app).patch("/loans/99999/repay").set(auth()).expect(404);

    s = (await request(app).get("/summary").set(auth())).body;
    expect(s).toMatchObject({ total_lent: 800.5, total_repaid: 500, overdue_amount: 0 });
  });

  it("isolates data between users", async () => {
    const other = await login("+919111111111");
    const otherAuth = { Authorization: `Bearer ${other}` };
    const list = await request(app).get("/loans").set(otherAuth).expect(200);
    expect(list.body).toHaveLength(0);
    const mine = await request(app).get("/loans").set(auth());
    await request(app).patch(`/loans/${mine.body[0].id}/repay`).set(otherAuth).expect(404);
  });

  it("accepts a receipt upload", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const res = await request(app).post("/loans").set(auth())
      .field("friend_name", "Amit").field("amount", "100").field("due_date", daysFromNow(2))
      .attach("receipt", png, { filename: "r.png", contentType: "image/png" }).expect(201);
    expect(res.body.receipt_url).toMatch(/^\/uploads\/.+\.png$/);
    await request(app).get(res.body.receipt_url).expect(200);
  });
});
