import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppRoutes } from "@/routes/app-routes";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import "@/lib/i18n/i18n";

const queryClient = new QueryClient();

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="featbit:theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
