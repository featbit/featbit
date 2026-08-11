import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import { AppRoutes } from "@/routes/app-routes"
import "@/lib/i18n/i18n"

export function App() {
  const { baseHref } = getRuntimeEnv()
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ThemeProvider defaultTheme="system" storageKey="featbit:theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={baseHref}>
          <AppRoutes />
        </BrowserRouter>
        <Toaster position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
