import { NextResponse, type NextRequest } from "next/server";
import {
  checkPassword,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { adminPassword, authSecret } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!adminPassword() || !authSecret()) {
    return NextResponse.json(
      { error: "Admin auth is not configured. Set ADMIN_PASSWORD and AUTH_SECRET." },
      { status: 503 },
    );
  }

  let password = "";
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      password = (await req.json())?.password ?? "";
    } else {
      const form = await req.formData();
      password = String(form.get("password") ?? "");
    }
  } catch {
    password = "";
  }

  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...sessionCookieOptions(), value: token });
  return res;
}
