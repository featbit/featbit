import { ThemeProvider } from "@/components/theme/theme-provider";
import { AuthProvider } from "@/lib/featbit-auth/auth-context";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
