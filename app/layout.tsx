import type { Metadata, Viewport } from "next";
import { Libre_Franklin } from "next/font/google";

import { Analytics } from "@vercel/analytics/next";

import { ChatShell } from "@/components/chat/chat-shell";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SourceDrawer } from "@/components/source-drawer/source-drawer";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

// Franklin Gothic is the face of American statistical almanacs; Libre Franklin is its open revival.
const franklin = Libre_Franklin({
  variable: "--font-franklin",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.mkebudget.app"),
  title: "Milwaukee Budget Decoder",
  description:
    "The City of Milwaukee 2027 proposed budget, explained, with every number cited to its page.",
};

// Browser toolbar color follows the theme (Safari, Chrome and Edge on phones); ThemeToggle updates it
// when the visitor picks a theme that differs from the system.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${franklin.variable} h-full antialiased`} suppressHydrationWarning>
      {/* Applies the saved theme before first paint, so the page never flashes the wrong one. */}
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-full flex flex-col">
        <ChatShell enabled={process.env.CHAT_ENABLED === 'true'}>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ChatShell>
        <SourceDrawer />
        <Analytics />
      </body>
    </html>
  );
}
