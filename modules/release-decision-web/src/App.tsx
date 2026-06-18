import { useEffect } from "react";
import RootLayout from "@/app/layout";
import DashboardLayout from "@/app/(dashboard)/layout";
import AuthLayout from "@/app/(auth)/layout";
import LoginPage from "@/app/(auth)/login/page";
import ExperimentsPage from "@/app/(dashboard)/experiments/page";
import MetricsPage from "@/app/(dashboard)/metrics/page";
import NewExperimentPage from "@/app/(dashboard)/experiments/new/page";
import EnvSettingsPage from "@/app/(dashboard)/data/env-settings/page";
import { ExperimentDetailClient } from "@/app/(project)/experiments/[id]/experiment-detail-client";
import { RouterProvider, usePathname, useRouter } from "@/lib/router";

function normalizeLegacyExperimentsPath(pathname: string) {
  if (pathname === "/experiments") return "/";
  if (pathname === "/experiments/new") return "/new";

  const match = pathname.match(/^\/experiments\/([^/]+)$/);
  return match ? `/${match[1]}` : pathname;
}

function Routes() {
  const pathname = usePathname();
  const router = useRouter();
  const routePath = normalizeLegacyExperimentsPath(pathname);

  useEffect(() => {
    if (routePath !== pathname) {
      router.replace(routePath);
    }
  }, [pathname, routePath, router]);

  if (pathname === "/login") {
    return (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    );
  }

  let page: React.ReactNode;
  let isExperimentDetailPage = false;
  if (routePath === "/") {
    page = <ExperimentsPage />;
  } else if (routePath === "/metrics") {
    page = <MetricsPage />;
  } else if (routePath === "/new") {
    page = <NewExperimentPage />;
  } else if (routePath === "/data/env-settings") {
    page = <EnvSettingsPage />;
  } else {
    const match = routePath.match(/^\/([^/]+)$/);
    if (match) {
      isExperimentDetailPage = true;
      page = <ExperimentDetailClient id={decodeURIComponent(match[1])} />;
    } else {
      page = (
        <div className="mx-auto max-w-2xl p-8 text-sm text-muted-foreground">
          Page not found.
        </div>
      );
    }
  }

  return (
    <DashboardLayout
      hideBackToFeatBit={isExperimentDetailPage}
      contentClassName={
        isExperimentDetailPage ? "overflow-hidden p-0 md:p-0 lg:p-0" : undefined
      }
    >
      {page}
    </DashboardLayout>
  );
}

export function App() {
  return (
    <RootLayout>
      <RouterProvider>
        <Routes />
      </RouterProvider>
    </RootLayout>
  );
}
