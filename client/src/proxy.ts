import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

type Role = "ADMIN" | "OWNER" | "CUSTOMER";

type DecodedToken = {
  role?: Role;
  exp?: number;
};

const PUBLIC_EXACT_ROUTES = ["/", "/login", "/register", "/forgot-password", "/otp"];
const PUBLIC_ROUTE_PREFIXES = ["/reset-password", "/customer/cars"];

const ROLE_PREFIX: Record<Role, string> = {
  ADMIN: "/admin",
  OWNER: "/owner",
  CUSTOMER: "/customer",
};

const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin/kyc",
  OWNER: "/owner/dashboard",
  CUSTOMER: "/customer/cars",
};

function isPublicRoute(pathname: string) {
  return (
    PUBLIC_EXACT_ROUTES.includes(pathname) ||
    PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function redirectToLogin(req: NextRequest, clearToken = false) {
  const loginUrl = new URL("/login", req.url);
  const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (returnTo !== "/login") loginUrl.searchParams.set("returnTo", returnTo);

  const response = NextResponse.redirect(loginUrl);
  if (clearToken) response.cookies.delete("token");
  return response;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;
  const publicRoute = isPublicRoute(pathname);

  if (!token) {
    return publicRoute ? NextResponse.next() : redirectToLogin(req);
  }

  let decoded: DecodedToken;
  try {
    decoded = jwtDecode<DecodedToken>(token);
  } catch {
    return redirectToLogin(req, true);
  }

  const role = decoded.role;
  if (!role || !(role in ROLE_PREFIX)) {
    return redirectToLogin(req, true);
  }

  if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
    return redirectToLogin(req, true);
  }

  // Keep the marketing site and public marketplace available to signed-in users.
  if (publicRoute) {
    if (pathname === "/login" || pathname === "/register") {
      return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  const requestedWorkspace = (Object.values(ROLE_PREFIX) as string[]).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (requestedWorkspace && requestedWorkspace !== ROLE_PREFIX[role]) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.json$).*)"],
};
