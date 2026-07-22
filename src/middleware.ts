import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import type { Role } from "@prisma/client";

const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  WORKER: "/worker",
  DRIVER: "/driver",
  CLIENT: "/client",
};

const PROTECTED_PREFIXES: Array<{ prefix: string; role: Role }> = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/worker", role: "WORKER" },
  { prefix: "/driver", role: "DRIVER" },
  { prefix: "/client", role: "CLIENT" },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = PROTECTED_PREFIXES.find((p) => pathname.startsWith(p.prefix));
  if (!match) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role !== match.role) {
    // Never let a role browse another role's dashboard, even if they guess the URL.
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/worker/:path*", "/driver/:path*", "/client/:path*"],
};
