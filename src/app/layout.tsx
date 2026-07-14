import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/AppLayout";
import { createClient } from "@/utils/supabase/server";
import { NotificationProvider } from "@/contexts/NotificationContext";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Bina Odontología Integral",
  description: "Sistema de gestión dental integral",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bina Odonto",
  },
};

export const viewport = {
  themeColor: "#8C7156",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  let role = 'professional'; // default
  if (session?.user) {
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
    if (data) {
      role = data.role;
    }
  }

  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased light`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL,GRAD,opsz@400,0,0,24&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bina Odonto" />
      </head>
      <body>
        <NotificationProvider>
          <AppLayout role={role}>{children}</AppLayout>
        </NotificationProvider>
      </body>
    </html>
  );
}
