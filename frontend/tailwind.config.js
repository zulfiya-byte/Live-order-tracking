export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand:        "#29ABE2",   // PXP / site sky blue — accents, borders, icons
        "brand-soft": "#6EC1E4",   // site primary tint
        "brand-btn":  "#0369A1",   // button blue (5.9:1 contrast on white)
        "brand-hover":"#025A87",   // button hover
        "brand-light":"#E8F4FB",   // light tint — card/badge backgrounds
        "brand-mid":  "#1A8AB8",   // borders, dividers
        navy:         "#15233B",   // site nav/footer navy — headings, table header, dark panels
        "navy-header":"#15233B",   // table thead
        surface:      "#F5F8FB",   // page background
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["Fira Code", "JetBrains Mono", "monospace"],
      },
      // Softer, more corporate corners (less bubbly than Tailwind defaults).
      borderRadius: {
        lg:    "0.5rem",    // 8px
        xl:    "0.625rem",  // 10px (was 12)
        "2xl": "0.75rem",   // 12px (was 16)
        "3xl": "1rem",      // 16px (was 24)
      },
      boxShadow: {
        card:        "0 1px 3px rgba(21,35,59,0.06), 0 1px 2px rgba(21,35,59,0.04)",
        "card-hover":"0 10px 28px rgba(21,35,59,0.10)",
        "modal":     "0 20px 60px rgba(21,35,59,0.18)",
      },
      animation: {
        "fade-in":   "fadeIn 0.25s ease-out both",
        "slide-up":  "slideUp 0.3s ease-out both",
        "rise":      "rise 0.5s cubic-bezier(0.2,0.7,0.3,1) both",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "pop-in":    "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
        "float":     "float 3.2s ease-in-out infinite",
        "spin":      "spinSlow 0.75s linear infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        rise:     { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        pulseDot: { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.4 } },
        popIn:    { "0%": { opacity: 0, transform: "scale(0.92)" }, "60%": { transform: "scale(1.03)" }, "100%": { opacity: 1, transform: "scale(1)" } },
        float:    { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-5px)" } },
        spinSlow: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
      },
    },
  },
  plugins: [],
}
