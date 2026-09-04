import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/components/theme/theme-provider";

function Toaster({ closeButton = true, ...props }: ToasterProps) {
  const { theme } = useTheme();

  return <Sonner theme={theme} closeButton={closeButton} {...props} />;
}

export { Toaster };
