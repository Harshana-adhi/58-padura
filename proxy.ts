import { NextRequest, NextResponse } from "next/server";

// UX-only redirect so an unauthenticated visitor doesn't see a flash
// of the admin shell before being sent to login. The real check is
// requireAdmin() at the top of every Server Action — this never
// verifies the cookie's signature.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";
  const hasCookie = request.cookies.has("padura_admin");

  if (pathname.startsWith("/admin") && !isLoginPage && !hasCookie) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (isLoginPage && hasCookie) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
