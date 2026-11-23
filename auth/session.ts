import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE_NAME = "padura_admin";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 h

function secret() {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 random bytes");
  }
  return new TextEncoder().encode(raw);
}

export interface SessionPayload {
  sid: string;
  operator: string;
}

/** Creates the DB-backed session row, signs the cookie, and sets it. */
export async function createSession(operator: string): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const { data, error } = await supabase
    .from("admin_sessions")
    .insert({ operator, expires_at: expiresAt.toISOString() })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not create session");

  const jwt = await new SignJWT({ sid: data.id, operator })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/**
 * The real authorization check. Middleware route-guards are UX only;
 * every Server Action must call this before touching admin_* functions.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const store = await cookies();
  const jwt = store.get(COOKIE_NAME)?.value;
  if (!jwt) throw new Error("UNAUTHORIZED");

  let payload: SessionPayload;
  try {
    const verified = await jwtVerify(jwt, secret());
    payload = verified.payload as unknown as SessionPayload;
  } catch {
    throw new Error("UNAUTHORIZED");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("id, expires_at, revoked_at")
    .eq("id", payload.sid)
    .single();

  if (error || !data || data.revoked_at || new Date(data.expires_at) < new Date()) {
    throw new Error("UNAUTHORIZED");
  }

  return payload;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const jwt = store.get(COOKIE_NAME)?.value;
  store.delete(COOKIE_NAME);
  if (!jwt) return;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    const sid = (payload as unknown as SessionPayload).sid;
    const supabase = createAdminClient();
    await supabase.from("admin_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", sid);
  } catch {
    // cookie was already invalid; nothing to revoke
  }
}

/** Revokes every active session at once ("Sign out all devices"). */
export async function destroyAllSessions(): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("admin_sessions").update({ revoked_at: new Date().toISOString() }).is("revoked_at", null);
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Hashes the client IP so admin_login_attempts never stores it raw. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}
