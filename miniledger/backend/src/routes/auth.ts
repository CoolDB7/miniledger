import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { pool } from "../db";
import { asyncHandler } from "../middleware";

const router = Router();

// E.164-ish: optional +, then 10-15 digits
const phoneSchema = z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number");

router.post("/request-otp", asyncHandler(async (req, res) => {
  const parsed = z.object({ phone: phoneSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { phone } = parsed.data;

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + config.otpTtlMinutes * 60_000);

  // Invalidate any earlier codes so only the newest one works
  await pool.query("UPDATE otps SET used = true WHERE phone = $1 AND used = false", [phone]);
  await pool.query("INSERT INTO otps (phone, code, expires_at) VALUES ($1, $2, $3)", [phone, code, expiresAt]);

  // MOCK OTP: no SMS provider, so just print it
  console.log(`[OTP] ${phone} -> ${code} (valid ${config.otpTtlMinutes} min)`);
  res.json({ message: "OTP sent. Check the server log." });
}));

router.post("/verify-otp", asyncHandler(async (req, res) => {
  const parsed = z
    .object({ phone: phoneSchema, otp: z.string().regex(/^[0-9]{6}$/, "OTP must be 6 digits") })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { phone, otp } = parsed.data;

  // Atomically consume a matching, unexpired, unused OTP
  const consumed = await pool.query(
    `UPDATE otps SET used = true
     WHERE id = (SELECT id FROM otps
                 WHERE phone = $1 AND code = $2 AND used = false AND expires_at > now()
                 ORDER BY id DESC LIMIT 1)
     RETURNING id`,
    [phone, otp]
  );
  if (consumed.rowCount === 0) return res.status(401).json({ error: "Invalid or expired OTP" });

  // Create the user on first login
  const user = await pool.query(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id, phone`,
    [phone]
  );
  const { id } = user.rows[0];
  const token = jwt.sign({ sub: id }, config.jwtSecret, { expiresIn: "7d" });
  res.json({ token, user: user.rows[0] });
}));

export default router;
