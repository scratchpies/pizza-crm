import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        crust: "#7a3e1d",
        sauce: "#c0392b",
        basil: "#2e7d32",
      },
    },
  },
  plugins: [],
};
export default config;
