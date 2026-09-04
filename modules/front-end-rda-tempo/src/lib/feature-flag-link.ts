import { featbitAppPath } from "@/lib/featbit-auth/config";

type FeatBitLanguage = "en" | "zh";

function resolveFeatBitLanguage(): FeatBitLanguage {
  if (typeof window === "undefined") return "en";

  const routeLanguage = window.location.pathname
    .split("/")
    .filter(Boolean)[0];

  if (routeLanguage === "zh" || routeLanguage === "en") {
    return routeLanguage;
  }

  return document.documentElement.lang.toLowerCase().startsWith("zh")
    ? "zh"
    : "en";
}

export function featureFlagTargetingUrl(flagKey: string): string {
  const language = resolveFeatBitLanguage();
  return featbitAppPath(
    `/${language}/feature-flags/${encodeURIComponent(flagKey)}/targeting`,
  );
}
