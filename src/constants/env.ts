import { config } from "dotenv";
config();

export const PORT = Number.parseInt(process.env.PORT || "1234");

export const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/task-manager";

export const MONGODB_URI_TEST =
  process.env.MONGODB_URI_TEST || "mongodb://127.0.0.1:27017/task-manager-test";

export const NODE_ENV = process.env.NODE_ENV || "prod";

export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID as string;
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY as string;
export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID as string;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME as string;
export const R2_SIGNED_URL_EXPIRY_TIME = Number.parseInt(
  process.env.R2_SIGNED_URL_EXPIRY_TIME || "300"
);

export const NODE_MAILER_USER = process.env.NODE_MAILER_USER as string;
export const NODE_MAILER_PASS = process.env.NODE_MAILER_PASS as string;
export const NODE_MAILER_SMTP_HOST = process.env
  .NODE_MAILER_SMTP_HOST as string;
export const NODE_MAILER_SMTP_PORT = process.env
  .NODE_MAILER_SMTP_PORT as string;
export const NODE_MAILER_SENDER_EMAIL = process.env
  .NODE_MAILER_SENDER_EMAIL as string;

export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN?.split(",")
  : "*";

export const JWT_SECRET = process.env.JWT_SECRET || "superSecret";
