import { pixelBasedPreset } from "react-email";

const emailTheme = {
  borderRadius: {
    full: "9999px",
    lg: "10px",
    md: "8px",
    sm: "4px",
    xl: "16px",
  },
  colors: {
    background: "#ffffff",
    backgroundDark: "#0a0a0a",
    border: "#e9e6e1",
    borderDark: "#282828",
    error: "#c5353e",
    primary: "#6e2bf5",
    primaryDark: "#0a0a0a",
    secondary: "#efece8",
    secondaryDark: "#e5e5e5",
    success: "#349d62",
    text: "#1f1c1a",
    textDark: "#ffffff",
    textLight: "#6b655f",
    textMuted: "#a1a1a1",
    warning: "#dc932e",
  },
  fonts: {
    mono: '"SF Mono", Monaco, Inconsolata, "Fira Code", "Fira Mono", "Roboto Mono", "Courier New", monospace',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  spacing: {
    "2xl": "48px",
    lg: "24px",
    md: "16px",
    sm: "8px",
    xl: "32px",
    xs: "4px",
  },
};

const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        accent: emailTheme.colors.secondary,
        "accent-foreground": emailTheme.colors.text,
        background: emailTheme.colors.background,
        border: emailTheme.colors.border,
        card: emailTheme.colors.background,
        "card-foreground": emailTheme.colors.text,
        destructive: emailTheme.colors.error,
        "destructive-foreground": emailTheme.colors.textDark,
        foreground: emailTheme.colors.text,
        muted: emailTheme.colors.secondary,
        "muted-foreground": emailTheme.colors.textLight,
        primary: emailTheme.colors.primary,
        "primary-dark": emailTheme.colors.primaryDark,
        "primary-foreground": emailTheme.colors.textDark,
        secondary: emailTheme.colors.secondary,
        "secondary-dark": emailTheme.colors.secondaryDark,
        "secondary-foreground": emailTheme.colors.text,
      },
      fontFamily: {
        mono: emailTheme.fonts.mono,
        sans: emailTheme.fonts.sans,
      },
    },
  },
};

export { emailTheme, tailwindConfig };
