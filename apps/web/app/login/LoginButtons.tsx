"use client";

import { signIn } from "next-auth/react";
import Button from "@/components/ui/Button";

export default function LoginButtons({
  next,
  googleConfigured,
  devAuth,
}: {
  next: string;
  googleConfigured: boolean;
  devAuth: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {googleConfigured ? (
        <Button
          onClick={() => signIn("google", { callbackUrl: next })}
          style={{ width: "100%" }}
        >
          continue with google
        </Button>
      ) : (
        <div
          className="banner info"
          style={{ marginBottom: 0, display: "block" }}
        >
          <p style={{ marginBottom: 8 }}>
            <b>google sign-in isn't set up yet.</b>
          </p>
          <p className="dim">
            set <span className="mono">AUTH_GOOGLE_ID</span> and{" "}
            <span className="mono">AUTH_GOOGLE_SECRET</span> in{" "}
            <span className="mono">.env</span> (from a google cloud oauth
            client) and restart the server. or enable{" "}
            <span className="mono">VAL_DEV_AUTH=true</span> for local dev
            testing without google.
          </p>
        </div>
      )}
      {devAuth && (
        <Button
          variant="ghost"
          onClick={() => signIn("dev", { callbackUrl: next })}
          style={{ width: "100%" }}
        >
          dev login (no google)
        </Button>
      )}
    </div>
  );
}
