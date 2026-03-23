/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f2ead7",
        ink: "#7e786f",
        line: "#d2c6ab",
        accent: "#95846a",
        panel: "#f7f0df",
      },
      fontFamily: {
        display: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        body: ["Instrument Sans", "Avenir Next", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        paper: "0 0 0 1px rgba(167, 152, 120, 0.16)",
      },
    },
  },
  plugins: [],
};
