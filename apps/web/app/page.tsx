import Link from "next/link";
import { auth } from "@/lib/auth";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const FEATURES = [
  {
    title: "daily shop",
    body: "your store rotation with vp prices and a live reset countdown.",
  },
  {
    title: "night market",
    body: "appears only when it's live — discount badges and discounted prices.",
  },
  {
    title: "wallet",
    body: "vp and radianite balances at a glance.",
  },
  {
    title: "live match",
    body: "agent select side, your locked agent, and the full teammate roster.",
  },
];

export default async function Home() {
  const session = await auth();

  return (
    <>
      <div className="hero">
        <h1>
          daily shop <span className="accent">+</span> live match
        </h1>
        <p>your valorant store rotation and current game, in one place.</p>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          marginBottom: 24,
        }}
      >
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <div className="card-title" style={{ marginBottom: 10 }}>
              <span>{f.title}</span>
            </div>
            <p className="dim">{f.body}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>
              connect with google to get started
            </h2>
            <p className="dim">
              sign in, paste your riot ssid once, and your shop shows up.
            </p>
          </div>
          {session?.user ? (
            <Link href="/dashboard">
              <Button style={{ marginTop: 8 }}>open dashboard</Button>
            </Link>
          ) : (
            <div style={{ marginTop: 8 }}>
              <GoogleSignInButton label="log in with google" />
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
