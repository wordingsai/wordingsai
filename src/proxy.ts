import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // 1. Define route groups cleanly
  const protectedRoutes = [
    "/dashboard",
    "/contracts",
    "/rules",
    "/clauses",
    "/clause-library",
    "/settings",
    "/upgrade",
  ];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  // These onboarding sub-routes are allowed even if the user already has an org:
  // choose-plan is a post-create step; create lets users add a second org.
  const isOnboardingChoosePlan = pathname.startsWith("/onboarding/choose-plan");
  const isOnboardingCreate = pathname.startsWith("/onboarding/create");
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup");

  // 2. Early exit: If no session cookie exists, redirect immediately (Fast Edge Check)
  if (!sessionCookie) {
    if (isProtectedRoute || isOnboardingRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // 3. User has a cookie. Fetch full session via API to bypass Edge limitations.
  try {
    const sessionRes = await fetch(
      `${request.nextUrl.origin}/api/auth/get-session`,
      {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      },
    );

    const sessionData = await sessionRes.json();

    console.log(`[Proxy] Session data for ${pathname}:`, {
      hasUser: !!sessionData?.user,
      hasSession: !!sessionData?.session,
      activeOrg: sessionData?.session?.activeOrganizationId,
    });

    // If cookie was invalid or expired
    if (!sessionData || !sessionData.user) {
      if (isProtectedRoute || isOnboardingRoute) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      return NextResponse.next();
    }

    const hasOrg = !!sessionData.session?.activeOrganizationId;

    // A. Redirect logged-in users away from auth routes
    if (isAuthRoute) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // B. Redirect to onboarding if they try to access protected apps without an org
    if (!hasOrg && isProtectedRoute) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // C. Prevent access to onboarding if they already have an active organization setup,
    //    EXCEPT for /onboarding/create (users may create additional orgs) and
    //    /onboarding/choose-plan (post-creation plan picker).
    if (hasOrg && isOnboardingRoute && !isOnboardingChoosePlan && !isOnboardingCreate) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  } catch (error) {
    console.error("Proxy session fetch error:", error);
    // Fallback: If the API fetch fails for some reason, secure the protected routes
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

// Ensure the matcher catches everything except static files and API routes
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
