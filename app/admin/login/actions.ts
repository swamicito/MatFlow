"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PLATFORM_ADMIN_COOKIE,
  getPlatformAdminSecret,
} from "@/lib/auth/platform-admin";

export async function loginAsPlatformAdmin(
  secret: string,
): Promise<{ ok: false; error: string } | { ok: true }> {
  if (!secret || secret !== getPlatformAdminSecret()) {
    return { ok: false, error: "Invalid secret." };
  }

  const store = await cookies();
  store.set(PLATFORM_ADMIN_COOKIE, secret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return { ok: true };
}

export async function logoutPlatformAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(PLATFORM_ADMIN_COOKIE);
  redirect("/admin/login");
}
