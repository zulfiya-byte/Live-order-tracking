export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand:        "#29ABE2",   // PXP logo blue — accents, borders, icon fills
        "brand-btn":  "#0369A1",   // darker PXP blue — buttons (5.9:1 contrast on white)
        "brand-hover":"#025A87",   // button hover state
        "brand-light":"#E0F5FB",   // light tint — card/badge backgrounds
        "brand-mid":  "#1A8AB8",   // mid — borders, dividers
        navy:         "#0F172A",   // near-black — headings, table header bg
        "navy-header":"#002856",   // original navy — kept for table thead only
        surface:      "#F4F9FC",   // page background
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Fira Sans", "system-ui", "sans-serif"],
        mono: ["Fira Code", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card:       "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover":"0 6px 20px rgba(41,171,226,0.18)",
        "modal":    "0 20px 60px rgba(0,0,0,0.18)",
      },
      animation: {
        "fade-in":   "fadeIn 0.25s ease-out both",
        "slide-up":  "slideUp 0.3s ease-out both",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "pop-in":    "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
        "spin":      "spinSlow 0.75s linear infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        pulseDot: { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.4 } },
        popIn:    { "0%": { opacity: 0, transform: "scale(0.92)" }, "60%": { transform: "scale(1.03)" }, "100%": { opacity: 1, transform: "scale(1)" } },
        spinSlow: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
      },
    },
  },
  plugins: [],
}
