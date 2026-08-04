import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@xyflow/react/dist/style.css";
import { NavBar } from "@/components/NavBar";
import { StudyAutosave } from "@/components/StudyAutosave";

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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <StudyAutosave />
        <NavBar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
