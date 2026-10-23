import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { pool } from "../db";
import { asyncHandler, requireAuth } from "../middleware";

export const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) =>
      cb(null, crypto.randomBytes(16).toString("hex") + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic)$/.test(file.mimetype)),
});

const loanSchema = z.object({
  friend_name: z.string().trim().min(1, "Friend name is required").max(100),
  amount: z.coerce.number().positive("Amount must be positive").max(1_000_000_000),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD")
    .refine((d) => !Number.isNaN(Date.parse(d)), "Invalid date"),
});

// Columns returned to the client. Casting avoids pg returning NUMERIC as string and DATE as a JS Date.
const COLS = `id, friend_name, amount::float8 AS amount, due_date::text AS due_date,
  repaid_at, receipt_url, created_at,
  (repaid_at IS NULL AND due_date < CURRENT_DATE) AS is_overdue`;

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT ${COLS} FROM loans WHERE user_id = $1
     ORDER BY (repaid_at IS NOT NULL), due_date ASC, id DESC`,
    [res.locals.userId]
  );
  res.json(rows);
}));

// multipart (with optional `receipt` file) or plain JSON
router.post("/", upload.single("receipt"), asyncHandler(async (req, res) => {
  const parsed = loanSchema.safeParse(req.body);
  if (!parsed.success) {
    if (req.file) fs.unlink(req.file.path, () => {}); // don't keep orphan uploads
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { friend_name, amount, due_date } = parsed.data;
  const receiptUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const { rows } = await pool.query(
    `INSERT INTO loans (user_id, friend_name, amount, due_date, receipt_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${COLS}`,
    [res.locals.userId, friend_name, amount, due_date, receiptUrl]
  );
  res.status(201).json(rows[0]);
}));

router.patch("/:id/repay", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });

  const updated = await pool.query(
    `UPDATE loans SET repaid_at = now()
     WHERE id = $1 AND user_id = $2 AND repaid_at IS NULL RETURNING ${COLS}`,
    [id, res.locals.userId]
  );
  if (updated.rowCount) return res.json(updated.rows[0]);

  // Nothing updated: either it doesn't exist (or isn't yours) or it was already repaid
  const exists = await pool.query("SELECT 1 FROM loans WHERE id = $1 AND user_id = $2", [id, res.locals.userId]);
  if (exists.rowCount) return res.status(409).json({ error: "Loan already marked as repaid" });
  res.status(404).json({ error: "Loan not found" });
}));

export default router;
