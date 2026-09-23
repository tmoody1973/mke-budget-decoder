import type { Metadata } from "next";
import { Libre_Franklin } from "next/font/google";
import Link from "next/link";

import { AskButton, ChatShell } from "@/components/chat/chat-shell";
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
  title: "MKE Budget Decoder",
  description:
    "The City of Milwaukee 2027 proposed budget, explained, with every number cited to its page.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${franklin.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ChatShell enabled={process.env.CHAT_ENABLED === 'true'}>
          <header className="border-b border-rule">
            <nav aria-label="Site" className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
              <Link href="/" className="font-bold text-ink no-underline">MKE Budget Decoder</Link>
              <span className="flex items-center gap-4">
                <Link href="/receipt" className="text-sm text-ref underline">Your City Receipt</Link>
                <AskButton />
              </span>
            </nav>
          </header>
          {children}
        </ChatShell>
        <SourceDrawer />
      </body>
    </html>
  );
}
