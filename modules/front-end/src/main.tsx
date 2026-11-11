import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "@/app/app"
import "./index.css"
import "./styles/global-overrides.css"

async function renderApplication() {
  const settingsPreviewRequested =
    new URLSearchParams(window.location.search).get("preview") ===
    "flag-settings"
  if (
    import.meta.env.DEV &&
    (import.meta.env.VITE_FLAG_SETTINGS_PREVIEW === "1" ||
      settingsPreviewRequested ||
      sessionStorage.getItem("featbit:flag-settings-preview") === "1")
  ) {
    sessionStorage.setItem("featbit:flag-settings-preview", "1")
    const { startFlagSettingsPreview } =
      await import("@/features/flags/details/settings/preview/start-preview")
    startFlagSettingsPreview()
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void renderApplication()
