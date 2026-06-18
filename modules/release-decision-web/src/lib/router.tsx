import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { APP_BASE_PATH, appPath } from "@/lib/app-path";

type NavigateOptions = { replace?: boolean };

type RouterContextValue = {
  pathname: string;
  push: (href: string) => void;
  replace: (href: string) => void;
  refresh: () => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);

function stripBase(pathname: string) {
  if (APP_BASE_PATH && pathname === APP_BASE_PATH) return "/";
  if (APP_BASE_PATH && pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length) || "/";
  }
  return pathname || "/";
}

function currentPathname() {
  return stripBase(window.location.pathname);
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? "/" : currentPathname(),
  );

  const sync = useCallback(() => {
    setPathname(currentPathname());
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", sync);
    window.addEventListener("release-decision:navigate", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("release-decision:navigate", sync);
    };
  }, [sync]);

  const navigate = useCallback((href: string, options: NavigateOptions = {}) => {
    const target = appPath(href);
    if (options.replace) {
      window.history.replaceState(null, "", target);
    } else {
      window.history.pushState(null, "", target);
    }
    window.dispatchEvent(new Event("release-decision:navigate"));
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({
      pathname,
      push: (href) => navigate(href),
      replace: (href) => navigate(href, { replace: true }),
      refresh: () => window.dispatchEvent(new Event("release-decision:refresh")),
    }),
    [navigate, pathname],
  );

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

export function useRouter() {
  const router = useContext(RouterContext);
  if (!router) {
    throw new Error("useRouter must be used within RouterProvider");
  }
  return router;
}

export function usePathname() {
  return useRouter().pathname;
}

export const Link = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    replace?: boolean;
  }
>(function Link({ href, replace, onClick, ...props }, ref) {
  const router = useRouter();
  const isInternal = href.startsWith("/");
  const resolvedHref = isInternal ? appPath(href) : href;

  return (
    <a
      {...props}
      ref={ref}
      href={resolvedHref}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          !isInternal ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        if (replace) {
          router.replace(href);
        } else {
          router.push(href);
        }
      }}
    />
  );
});
