import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Job Tracker",
  description: "AI-powered job application tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-[#0f172a] text-slate-200">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
