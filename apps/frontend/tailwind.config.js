/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "var(--void)",
        "void-soft": "var(--void-soft)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        border: "var(--border)",
        signal: {
          dim: "var(--signal-dim)",
          core: "var(--signal-core)",
          bright: "var(--signal-bright)",
          peak: "var(--signal-peak)",
          critical: "var(--signal-critical)",
          insight: "var(--signal-insight)",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        "glow-sm": "var(--glow-sm)",
        "glow-md": "var(--glow-md)",
        "glow-lg": "var(--glow-lg)",
      },
    },
  },
  plugins: [],
};
