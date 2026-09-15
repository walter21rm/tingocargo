/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#1d8f64",
          600: "#177a55",
          700: "#136345",
          800: "#0f5132",
          900: "#064e3b"
        },
        accent: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#3b82f6",
          600: "#2563eb"
        },
        warning: {
          50: "#fef3c7",
          100: "#fde68a",
          500: "#f59e0b",
          600: "#d97706"
        }
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)"
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};
