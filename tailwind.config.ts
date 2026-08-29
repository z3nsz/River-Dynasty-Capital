import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F5F6F4",
        ink: "#14181C",
        muted: "#5A6169",
        hairline: "#DBDED8",
        navy: "#1E3A5F",
        gain: "#1B6B4A",
        loss: "#B23A2E",
      },
      fontFamily: {
        display: ["var(--font-newsreader)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
      maxWidth: {
        sheet: "72rem",
      },
    },
  },
  plugins: [],
};

export default config;
