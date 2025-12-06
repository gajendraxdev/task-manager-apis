import jwt, { type SignOptions } from "jsonwebtoken";
import { JWT_SECRET } from "../constants/env.ts";

export function genLoginToken(payload: object, options?: SignOptions): string {
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyJwt<T = object>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch (_error) {
    return null;
  }
}
