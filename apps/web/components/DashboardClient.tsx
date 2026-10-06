"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi, isExpired } from "@/lib/use-api";
import { bp } from "@/lib/basePath";
import DailyStore from "@/components/store/DailyStore";
import NightMarket from "@/components/store/NightMarket";
import MatchPanel from "@/components/match/MatchPanel";
import Banner from "@/components/ui/Banner";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import type { Account } from "@/lib/types";
import { ACCOUNT_CHANGED_EVENT } from "./AccountSwitcher";

type MeData = {
  user?: { email?: string };
  accounts?: Account[];
};

export default function DashboardClient() {
  const router = useRouter();
  const { status, data, error, reload } = useApi<MeData>("/api/me");
  const [busy, setBusy] = useState("");
  const [dataKey, setDataKey] = useState(0);

  // when the header switcher changes accounts, refetch everything
  // (remount via key — no page reload)
  useEffect(() => {
    const onSwitch = () => {
      reload();
      setDataKey((k) => k + 1);
    };
    window.addEventListener(ACCOUNT_CHANGED_EVENT, onSwitch);
    return () => window.removeEventListener(ACCOUNT_CHANGED_EVENT, onSwitch);
  }, [reload]);

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


      {status === "ok" && accounts.length > 0 && (
        <div key={dataKey}>
          <DailyStore />
          <NightMarket />
          <MatchPanel />
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
