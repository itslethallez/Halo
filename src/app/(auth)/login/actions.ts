"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, InvalidCredentialsError, TwoFactorRequiredError, InvalidTwoFactorCodeError } from "@/services/authService";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin",
  WORKER: "/worker",
  DRIVER: "/driver",
  CLIENT: "/client",
};

export interface LoginFormState {
  error?: string;
  needsTotp?: boolean;
}

export async function loginAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const totpCode = String(formData.get("totpCode") ?? "") || undefined;

  try {
    const { token, role } = await login({ email, password, totpCode });
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
    redirect(ROLE_HOME[role] ?? "/");
  } catch (error) {
    if (error instanceof TwoFactorRequiredError) {
      return { needsTotp: true };
    }
    if (error instanceof InvalidCredentialsError || error instanceof InvalidTwoFactorCodeError) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
