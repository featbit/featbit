import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"] as unknown as Config["darkMode"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {}
  }
} satisfies Config;
