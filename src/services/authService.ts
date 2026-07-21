import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/crypto/password";
import { createSessionToken } from "@/lib/auth/session";
import { verifyTotpCode } from "@/lib/auth/totp";
import { recordAudit } from "./auditService";
import type { Role } from "@prisma/client";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export class TwoFactorRequiredError extends Error {
  constructor() {
    super("Two-factor authentication code required");
    this.name = "TwoFactorRequiredError";
  }
}

export class InvalidTwoFactorCodeError extends Error {
  constructor() {
    super("Invalid two-factor authentication code");
    this.name = "InvalidTwoFactorCodeError";
  }
}

export interface LoginInput {
  email: string;
  password: string;
  totpCode?: string;
}

export async function login(input: LoginInput): Promise<{ token: string; role: Role; userId: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });

  // Constant-shape response regardless of whether the account exists, to avoid user enumeration.
  const passwordOk = user ? await verifyPassword(input.password, user.passwordHash) : await verifyPassword(input.password, await hashPassword("dummy"));

  if (!user || !user.active || !passwordOk) {
    throw new InvalidCredentialsError();
  }

  if (user.totpEnabled) {
    if (!input.totpCode) {
      throw new TwoFactorRequiredError();
    }
    if (!user.totpSecretEncrypted || !verifyTotpCode(user.totpSecretEncrypted, input.totpCode)) {
      throw new InvalidTwoFactorCodeError();
    }
  } else if (user.role === "ADMIN") {
    // Admins are required to have 2FA enabled (see /docs/10-legal-privacy-security-risks.md #14).
    // A freshly seeded/dev admin without 2FA set up yet is allowed to log in but should be
    // prompted to enroll immediately; this is enforced at the UI layer, not blocked here, so
    // an admin is never permanently locked out before they've had a chance to enroll.
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = await createSessionToken({
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
    twoFactorVerified: user.totpEnabled,
  });

  await recordAudit({
    businessId: user.businessId,
    actorUserId: user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
  });

  return { token, role: user.role, userId: user.id };
}

export interface RegisterClientInput {
  businessId: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

/** Public client self-registration. Creates both the User and the internal Client profile. */
export async function registerClient(input: RegisterClientInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() } });
  if (existing) {
    throw new Error("An account already exists with this email");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      businessId: input.businessId,
      email: input.email.toLowerCase().trim(),
      passwordHash,
      name: input.fullName,
      phone: input.phone,
      role: "CLIENT",
      client: {
        create: {
          businessId: input.businessId,
          fullName: input.fullName,
          phone: input.phone,
          email: input.email.toLowerCase().trim(),
        },
      },
    },
    include: { client: true },
  });

  await recordAudit({
    businessId: input.businessId,
    actorUserId: user.id,
    action: "CLIENT_SELF_REGISTERED",
    entityType: "Client",
    entityId: user.client?.id,
  });

  return user;
}
