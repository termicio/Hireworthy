import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Space_Grotesk, Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { CVProvider } from "@/lib/cv-context";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hireworthy — Know exactly where your CV stands",
  description: "AI-powered CV review and job match analysis. Get honest, specific feedback on your CV in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(spaceGrotesk.variable, inter.variable)}>
      <body className="flex min-h-screen bg-background text-foreground antialiased">
        <CVProvider>
          <Sidebar />
          <main className="flex-1 p-8 overflow-auto min-h-screen" style={{ marginLeft: "56px" }}>{children}</main>
        </CVProvider>
      </body>
    </html>
  );
}
