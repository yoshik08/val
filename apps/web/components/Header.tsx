import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import ThemeToggle from "./ThemeToggle";
import Button from "./ui/Button";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function Header() {
  const session = await auth();

  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link className="brand" href="/">
          val<span className="brand-dot">.</span>
        </Link>
        <div className="topbar-right">
          {session?.user && (
            <>
              <span className="acct on">{session.user.email}</span>
              <form action={signOutAction}>
                <Button
                  variant="ghost"
                  type="submit"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                >
                  sign out
                </Button>
              </form>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
