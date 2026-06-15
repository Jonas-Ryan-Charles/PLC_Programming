/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // VoltRung design language (master prompt §UI/UX)
        ink: "#0D1117", // app background
        panel: "#161B22", // panels
        gunmetal: "#374151", // chassis enclosure
        energised: "#F97316", // amber-orange active
        safe: "#22C55E", // confirmed output green
        fault: "#EF4444", // fault red
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "led-green": "0 0 8px 1px rgba(34,197,94,0.9)",
        "led-amber": "0 0 8px 1px rgba(249,115,22,0.9)",
      },
    },
  },
  plugins: [],
};
