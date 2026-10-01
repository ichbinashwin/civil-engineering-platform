import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AUTO_DARK_FROM_HOUR, AUTO_LIGHT_FROM_HOUR, THEMES, THEME_STORAGE_KEY } from "@/lib/theme";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "ACI 318-19 Punching Shear — Civil Engineering Platform",
  description: "Structural engineering calculations — ACI 318-19 two-way punching shear",
};

const STATIC_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'";

/** Background/ink per theme and mode, applied before first paint to avoid a light flash in dark mode. */
const FIRST_PAINT = Object.fromEntries(
  Object.values(THEMES).map((t) => [
    t.id,
    { light: [t.light.bg, t.light.ink], dark: [t.dark.bg, t.dark.ink] },
  ]),
);

const themeBootScript = `(function(){try{var m=${JSON.stringify(FIRST_PAINT)};var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})||"{}");var t=m[p.themeId]?p.themeId:"structural";var mode=p.mode==="light"||p.mode==="dark"?p.mode:(function(h){return h>=${AUTO_LIGHT_FROM_HOUR}&&h<${AUTO_DARK_FROM_HOUR}?"light":"dark"})(new Date().getHours());var c=m[t][mode];var r=document.documentElement;r.style.setProperty("--bg",c[0]);r.style.setProperty("--ink",c[1]);r.style.backgroundColor=c[0];r.style.colorScheme=mode;r.dataset.theme=t;r.dataset.mode=mode;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NEXT_PUBLIC_STATIC_EXPORT === "true" && (
          // Static hosting (GitHub Pages) cannot send HTTP headers; meta CSP is the fallback.
          // frame-ancestors is not honoured in a meta tag, so it is omitted here.
          <meta httpEquiv="Content-Security-Policy" content={STATIC_CSP} />
        )}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
