import "./globals.css";
import React from "react";

export const metadata = {
  title: "PreX Protocol | Terminal Presale",
  description: "Synthetic Pre-IPO Equity Engine on Robinhood Chain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-emerald-400 font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
