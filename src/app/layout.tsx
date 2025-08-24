import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dawn AI Agent",
  description: "Voice interface for the Dawn AI agent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={manrope.className}>
        {children}
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--baby-powder)',
              color: 'var(--raisin-black)',
              border: '1px solid var(--cambridge-blue)',
            },
            success: {
              style: {
                background: 'var(--beige)',
                color: 'var(--raisin-black)',
              },
            },
            error: {
              style: {
                background: '#ffebee',
                color: 'var(--raisin-black)',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
