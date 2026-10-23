import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://miniledger:miniledger@localhost:5432/miniledger",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  otpTtlMinutes: 5,
};
