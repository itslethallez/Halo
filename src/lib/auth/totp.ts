/**
 * TOTP-based two-factor authentication. Mandatory for admins, optional for other roles.
 * See /docs/10-legal-privacy-security-risks.md #14.
 */
import { authenticator } from "otplib";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildTotpKeyUri(secret: string, accountEmail: string): string {
  return authenticator.keyuri(accountEmail, "Halo", secret);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  return authenticator.check(code, secret);
}
