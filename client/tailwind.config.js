/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0e1a",
        primary: "#00e5ff",
        warning: "#f59e0b",
      },
    },
  },
  plugins: [],
};
