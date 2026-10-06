"use client";

import { SessionProvider } from "next-auth/react";

/** basePath points next-auth/react at the proxied auth routes (/val/api/auth/*). */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider basePath="/val/api/auth">{children}</SessionProvider>;
}
