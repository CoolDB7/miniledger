import { Router } from "express";
import { pool } from "../db";
import { asyncHandler, requireAuth } from "../middleware";

const router = Router();

router.get("/", requireAuth, asyncHandler(async (_req, res) => {
  // One query, conditional sums via FILTER
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(amount), 0)::float8                                                              AS total_lent,
       COALESCE(SUM(amount) FILTER (WHERE repaid_at IS NOT NULL), 0)::float8                         AS total_repaid,
       COALESCE(SUM(amount) FILTER (WHERE repaid_at IS NULL), 0)::float8                             AS outstanding,
       COALESCE(SUM(amount) FILTER (WHERE repaid_at IS NULL AND due_date < CURRENT_DATE), 0)::float8 AS overdue_amount
     FROM loans WHERE user_id = $1`,
    [res.locals.userId]
  );
  res.json(rows[0]);
}));

export default router;
