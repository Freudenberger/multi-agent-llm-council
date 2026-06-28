import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./AuthProvider";
import { CouncilProvider } from "./CouncilProvider";
import { auth } from "@/auth/config";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multi-Agent LLM Council",
  description:
    "Analyze questions, problems, and ideas using multiple specialized LLM agents with different perspectives.",
  icons: {
    icon: "/icon.png",
  },
};

/**
 * Applies the persisted theme before first paint to avoid a flash of the wrong
 * theme (FOUC). Runs synchronously in <head>: reads `theme` from localStorage,
 * defaults to dark when unset, and toggles the `.dark` class on <html>.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");document.documentElement.classList.toggle("dark",t!=="light");}catch(e){document.documentElement.classList.add("dark");}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider session={session}>
          <CouncilProvider>{children}</CouncilProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
