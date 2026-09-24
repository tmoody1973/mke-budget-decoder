import type { Metadata } from "next";
import { Libre_Franklin } from "next/font/google";

import { Analytics } from "@vercel/analytics/next";

import { ChatShell } from "@/components/chat/chat-shell";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SourceDrawer } from "@/components/source-drawer/source-drawer";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

// Franklin Gothic is the face of American statistical almanacs; Libre Franklin is its open revival.
const franklin = Libre_Franklin({
  variable: "--font-franklin",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Milwaukee Budget Decoder",
  description:
    "The City of Milwaukee 2027 proposed budget, explained, with every number cited to its page.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${franklin.variable} h-full antialiased`}>
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
