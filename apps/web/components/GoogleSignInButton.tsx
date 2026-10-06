"use client";

import { signIn } from "next-auth/react";
import Button from "./ui/Button";

/** Goes straight to Google — no intermediate /login page. */
export default function GoogleSignInButton({ label }: { label: string }) {
  return (
    <Button onClick={() => signIn("google", { callbackUrl: "/val/dashboard" })}>
      {label}
    </Button>
  );
}
