import type { Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Sora } from "next/font/google";

const hanken = Hanken_Grotesk({ display: "swap", subsets: ["latin"], variable: "--font-hanken" });
const sora = Sora({ display: "swap", subsets: ["latin"], variable: "--font-sora" });

const jetbrainsMono = JetBrains_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const fontVariables = `${hanken.variable} ${sora.variable} ${jetbrainsMono.variable}`;

const bodyFont = hanken.className;

const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { color: "white", media: "(prefers-color-scheme: light)" },
    { color: "black", media: "(prefers-color-scheme: dark)" },
  ],
  userScalable: true,
  width: "device-width",
};

export { bodyFont, fontVariables, viewport };
