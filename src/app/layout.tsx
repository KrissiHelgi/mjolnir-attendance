import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mjolnir Attendance",
  description: "Gym class attendance logging system",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch (_) {
    user = null
  }

  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 font-sans">
        {user && <Navigation />}
        <main className={user ? "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8" : ""}>
          {children}
        </main>
      </body>
    </html>
  );
}
