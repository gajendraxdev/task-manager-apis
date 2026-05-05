import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { sendNotificationType } from "../lib/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getTemplate = (type: sendNotificationType) => {
  const templates = {
    otp: fs.readFileSync(path.resolve(__dirname, "./otp-template.html"), "utf-8"),
    confirmation: "",
    "reset-password": fs.readFileSync(path.resolve(__dirname, "./reset-password-template.html"), "utf-8"),
  };

  return templates[type];
};
