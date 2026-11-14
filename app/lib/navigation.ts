const NAV_STACK_KEY = "owl_nav_stack";
const MAX_NAV_STACK_LENGTH = 50;

export interface BackNavigationRouter {
  back: () => void;
  push: (href: string) => void;
}

function readNavStack(): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(NAV_STACK_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return null;
  }
}

function writeNavStack(stack: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      NAV_STACK_KEY,
      JSON.stringify(stack.slice(-MAX_NAV_STACK_LENGTH))
    );
  } catch {
    // Ignore storage errors (e.g. restricted private browsing).
  }
}

/**
 * Records the active pathname in a per-tab sessionStorage stack so Back
 * navigation knows whether a previous in-app route exists across reloads.
 */
export function recordInAppRoute(pathname: string): void {
  if (!pathname) {
    return;
  }
  const stack = readNavStack();
  if (!stack) {
    return;
  }

  const top = stack[stack.length - 1];
  if (top === pathname) {
    return;
  }

  if (stack.length >= 2 && stack[stack.length - 2] === pathname) {
    stack.pop();
  } else {
    stack.push(pathname);
  }

  writeNavStack(stack);
}

function isSameOriginReferrer(): boolean {
  if (typeof document === "undefined" || !document.referrer) {
    return false;
  }
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Navigates back if the current tab has an in-app history entry to return to;
 * otherwise navigates to `fallbackHref` (defaulting to `/`).
 */
export function navigateBackOrHome(
  router: BackNavigationRouter,
  fallbackHref = "/"
): void {
  if (typeof window === "undefined" || window.history.length <= 1) {
    router.push(fallbackHref);
    return;
  }

  const stack = readNavStack();
  if (stack !== null) {
    if (stack.length > 1) {
      stack.pop();
      writeNavStack(stack);
      router.back();
      return;
    }
    router.push(fallbackHref);
    return;
  }

  if (isSameOriginReferrer()) {
    router.back();
  } else {
    router.push(fallbackHref);
  }
}
