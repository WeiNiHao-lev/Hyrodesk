import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@xyflow/react/dist/style.css";
import { NavBar } from "@/components/NavBar";
import { StudyAutosave } from "@/components/StudyAutosave";
import { AuthGate } from "@/components/AuthGate";
import { PrefsApplier } from "@/components/PrefsApplier";
import { Toaster } from "@/components/Toaster";
import { PREFS_BOOT } from "@/lib/prefs";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "HydroDesk — WTP / WWTP Simulation & Pre-Approval Studies",
  description:
    "Flowsheet simulation for water treatment, wastewater, desalination and demineralisation. Water balance, salt balance, energy, chemicals and pre-approval reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The boot script sets theme, text size and language before the first paint,
    // so the attributes on <html> differ from the server's on purpose.
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <PrefsApplier />
        <StudyAutosave />
        <NavBar />
        <main className="flex-1 flex flex-col"><AuthGate>{children}</AuthGate></main>
        <Toaster />
      </body>
    </html>
  );
}
