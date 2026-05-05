import { config } from "dotenv";
config();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

// ─── Server ───────────────────────────────────────────────────────────────────
export const PORT = Number.parseInt(process.env.PORT || "1234");
export const NODE_ENV = process.env.NODE_ENV || "development";

// ─── Database ─────────────────────────────────────────────────────────────────
export const DATABASE_URL = requireEnv("DATABASE_URL", "postgresql://localhost:5432/task-manager");

// ─── Auth ─────────────────────────────────────────────────────────────────────
// In production, JWT_SECRET must be explicitly set — no fallback allowed.
export const JWT_SECRET = NODE_ENV === "production"
  ? requireEnv("JWT_SECRET")
  : (process.env.JWT_SECRET || "superSecret_dev_only");

// ─── Storage (R2) ─────────────────────────────────────────────────────────────
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID as string;
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY as string;
export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID as string;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME as string;
export const R2_SIGNED_URL_EXPIRY_TIME = Number.parseInt(
  process.env.R2_SIGNED_URL_EXPIRY_TIME || "300"
);

// ─── Mailer ───────────────────────────────────────────────────────────────────
export const NODE_MAILER_USER = process.env.NODE_MAILER_USER as string;
export const NODE_MAILER_PASS = process.env.NODE_MAILER_PASS as string;
export const NODE_MAILER_SMTP_HOST = process.env.NODE_MAILER_SMTP_HOST as string;
export const NODE_MAILER_SMTP_PORT = process.env.NODE_MAILER_SMTP_PORT as string;
export const NODE_MAILER_SENDER_EMAIL = process.env.NODE_MAILER_SENDER_EMAIL as string;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In production, ALLOWED_ORIGIN must be explicitly set.
// In development, defaults to * with a warning.
const rawOrigin = process.env.ALLOWED_ORIGIN;
if (!rawOrigin && NODE_ENV === "production") {
  throw new Error("Missing required environment variable: ALLOWED_ORIGIN");
}
if (!rawOrigin) {
  console.warn("[env] ALLOWED_ORIGIN not set — defaulting to * (development only)");
}
export const ALLOWED_ORIGINS: string | string[] = rawOrigin ? rawOrigin.split(",") : "*";

// ─── App ──────────────────────────────────────────────────────────────────────
export const APP_URL = process.env.APP_URL || "http://localhost:5173";
