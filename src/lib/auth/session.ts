/**
 * Session tokens: signed + encrypted JWTs (JWE) stored in an httpOnly, secure cookie.
 * Hand-rolled rather than a full auth framework so the custom 4-role + 2FA + audit-log model
 * stays simple and explicit. See /docs/01-architecture.md §8 and /docs/03-permissions.md.
 */
import { EncryptJWT, jwtDecrypt } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE_NAME = "halo_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 hours

export interface SessionPayload {
  userId: string;
  businessId: string;
  role: Role;
  /** Only present once a session has completed a required 2FA challenge. */
  twoFactorVerified: boolean;
}

function getSessionKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set to a long random value. See .env.example.");
  }
  // Derive a 32-byte key deterministically from the configured secret.
  return new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const key = getSessionKey();
  return new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .encrypt(key);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const key = getSessionKey();
    const { payload } = await jwtDecrypt(token, key);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_SECONDS;
