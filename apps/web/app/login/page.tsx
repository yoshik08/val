import { redirect } from "next/navigation";
import { auth, GOOGLE_CONFIGURED, DEV_AUTH } from "@/lib/auth";
import Card from "@/components/ui/Card";
import LoginButtons from "./LoginButtons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  const { next } = await searchParams;
  const callbackUrl = next && next.startsWith("/") ? next : "/dashboard";

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <>
      <div className="hero">
        <h1>
          log <span className="accent">in</span>
        </h1>
        <p>sign in with google, then link your riot account with an ssid.</p>
      </div>

      <div style={{ maxWidth: 420 }}>
        <Card title="sign in">
          <LoginButtons
            next={callbackUrl}
            googleConfigured={GOOGLE_CONFIGURED}
            devAuth={DEV_AUTH}
          />
        </Card>
      </div>
    </>
  );
}
