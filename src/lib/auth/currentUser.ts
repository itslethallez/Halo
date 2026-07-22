import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

/** Reads and verifies the session cookie for the current request (Server Components / Actions). */
export async function getCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Loads the full current user record, or null if not authenticated. */
export async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

/** Convenience for passing into authz.can()/assertCan() calls from server actions. */
export async function getCurrentAuthzUser(): Promise<AuthzUser | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  return { id: session.userId, businessId: session.businessId, role: session.role };
}
