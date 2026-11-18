import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./auth-actions";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const head = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-head" });
export const metadata: Metadata = { title: "PathWise", description: "Plan your J-1 journey." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <html lang="en" className={`${body.variable} ${head.variable}`}>
      <body>
        <header className="top"><div className="wrap">
          <Link href="/" className="logo">PathWise</Link>
          <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {user ? (<>
              <Link href="/journey">My journey</Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/sponsors">Sponsors</Link>
              <Link href="/questionnaire">Edit answers</Link>
              <form action={signOut}><button className="btn ghost" type="submit">Log out</button></form>
            </>) : (<>
              <Link href="/sponsors">Sponsors</Link>
              <Link href="/login">Log in</Link>
              <Link className="btn" href="/signup">Get started</Link>
            </>)}
          </nav>
        </div></header>
        <main>{children}</main>
        <footer className="wrap muted" style={{ fontSize: 13, padding: "32px 20px" }}>
          PathWise is an independent planning tool. It is not a designated J-1 sponsor, placement agency, or law firm and does not guarantee eligibility, placement, or visa approval.
        </footer>
      </body>
    </html>
  );
}
