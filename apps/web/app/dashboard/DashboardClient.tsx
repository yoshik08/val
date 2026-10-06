"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi, isExpired } from "@/lib/use-api";
import { bp } from "@/lib/basePath";
import WalletBar from "@/components/store/WalletBar";
import DailyStore from "@/components/store/DailyStore";
import NightMarket from "@/components/store/NightMarket";
import MatchPanel from "@/components/match/MatchPanel";
import Banner from "@/components/ui/Banner";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import type { Account } from "@/lib/types";

type MeData = {
  user?: { email?: string };
  accounts?: Account[];
};

export default function DashboardClient() {
  const router = useRouter();
  const { status, data, error, reload } = useApi<MeData>("/api/me");
  const [busy, setBusy] = useState("");

  const expired = status === "error" && isExpired(error);
  const accounts = status === "ok" ? data?.accounts ?? [] : [];

  useEffect(() => {
    // no riot account linked yet -> go connect one
    if (status === "ok" && (!data?.accounts || data.accounts.length === 0)) {
      router.replace("/connect");
    }
  }, [status, data, router]);

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await fetch(bp("/api/riot/disconnect"), { method: "DELETE" });
    } catch {
      /* best effort */
    }
    router.push("/connect");
    router.refresh();
  };

  const switchAccount = async (accountId?: string) => {
    if (!accountId) return;
    setBusy(accountId);
    try {
      await fetch(bp("/api/riot/switch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
    } catch {
      /* best effort */
    }
    setBusy("");
    reload();
    router.refresh();
  };

  return (
    <>
      <div className="hero">
        <h1>
          daily shop <span className="accent">+</span> live match
        </h1>
        <p>your valorant store rotation and current game, in one place.</p>
      </div>

      {expired && (
        <Banner
          tone="warn"
          action={{ label: "re-connect", href: "/connect" }}
        >
          your riot session expired — grab a fresh ssid cookie and reconnect.
        </Banner>
      )}

      {status === "loading" && (
        <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
          <Skeleton height={90} />
        </div>
      )}

      {status === "error" && !expired && (
        <Banner tone="info">
          {error?.message ?? "couldn't load your account."}
        </Banner>
      )}

      {status === "ok" && accounts.length > 0 && <WalletBar />}

      {status === "ok" && accounts.length > 0 && <DailyStore />}
      {status === "ok" && accounts.length > 0 && <NightMarket />}
      {status === "ok" && accounts.length > 0 && <MatchPanel />}

      {(status === "ok" && accounts.length > 1) && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">
            <span>accounts</span>
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {accounts.map((a) => {
              const label =
                a.gameName && a.tagLine
                  ? `${a.gameName} #${a.tagLine}`
                  : a.accountId ?? "account";
              return (
                <button
                  key={a.accountId ?? label}
                  className={`acct-chip${a.active ? " active" : ""}`}
                  onClick={() => switchAccount(a.accountId)}
                  disabled={busy !== "" || a.active}
                >
                  {busy === a.accountId ? "switching…" : label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {status === "ok" && accounts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Button
            variant="ghost"
            onClick={disconnect}
            disabled={busy === "disconnect"}
          >
            {busy === "disconnect" ? "disconnecting…" : "disconnect"}
          </Button>
        </div>
      )}
    </>
  );
}
