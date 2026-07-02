import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/lib/theme/theme-provider";

const Toaster = ({ closeButton = true, ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      closeButton={closeButton}
      {...props}
    />
  );
};

export { Toaster };
