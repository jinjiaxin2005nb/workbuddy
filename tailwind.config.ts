import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        iwuli: {
          bg: "#1f242c",
          panel: "#2a313b",
          panel2: "#323a46",
          border: "#3d4654",
          accent: "#3d8bff",
          accent2: "#22c55e",
          warn: "#f59e0b",
          text: "#e6ebf2",
          sub: "#8a95a5",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
