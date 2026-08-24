import { NextRequest, NextResponse } from "next/server";

const PUBLIC_EXACT_ROUTES = ["/", "/login", "/register", "/forgot-password", "/otp"];
const PUBLIC_ROUTE_PREFIXES = ["/customer/cars"];

function isPublicRoute(pathname: string) {
  return (
    PUBLIC_EXACT_ROUTES.includes(pathname) ||
    PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL("/login", req.url);
  const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (returnTo !== "/login") loginUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(loginUrl);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  // This proxy is only a coarse navigation gate. It intentionally does not decode
  // or trust JWT claims. Role, expiry and account status are verified by the backend
  // and the protected workspace layouts source their session from /api/auth/me.
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (!token) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.json$).*)"],
};
