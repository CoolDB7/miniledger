import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import authRoutes from "./routes/auth";
import loanRoutes, { UPLOAD_DIR } from "./routes/loans";
import summaryRoutes from "./routes/summary";

export const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/loans", loanRoutes);
app.use("/summary", summaryRoutes);

// Central error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
