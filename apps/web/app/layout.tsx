import type { Metadata } from "next";
import "./globals.css";
import Cursor from "@/components/Cursor";
import Header from "@/components/Header";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "val — shop + live match",
  description: "your valorant store rotation and current game, in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/val/fonts/HankenGrotesk-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("val-theme");if(t)document.documentElement.dataset.theme=t;else if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.dataset.theme="dark";}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers>
          <Cursor />
          <Header />
          <main className="wrap">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
