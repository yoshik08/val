"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SsidGuide from "@/components/SsidGuide";
import Skeleton from "@/components/ui/Skeleton";
import type { StatusData } from "@/lib/types";
import { bp } from "@/lib/basePath";

export default function ConnectForm() {
  const router = useRouter();
  const [ssid, setSsid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState<"loading" | "connected" | "expired" | "unknown">("loading");
  const [account, setAccount] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(bp("/api/status"), { cache: "no-store" });
        const data: StatusData & { error?: string; code?: string } = await res.json().catch(() => ({} as StatusData));
        if (cancelled) return;
        if (res.ok && data.connected) {
          setStatus("connected");
          setAccount(data.gameName && data.tagLine ? `${data.gameName} #${data.tagLine}` : "connected");
        } else if (data.code === "SSID_EXPIRED" || res.status === 401) {
          setStatus("expired");
        } else {
          setStatus("unknown");
        }
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async () => {
    setErr("");
    const value = ssid.trim();
    if (!value) {
      setErr("paste your ssid cookie first");
      return;
    }
    setBusy(true);
    try {
      // accepts either the raw ssid value or the full cookie string
      const res = await fetch(bp("/api/riot/connect"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || `connect failed: ${res.status}`);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErr("couldn't reach the server — is the api running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="connect riot account">
      <p className="dim" style={{ marginBottom: 14 }}>
        riot now blocks password logins from websites, so we use your riot
        session cookie instead. your password never touches this site.
      </p>

      {status === "loading" && (
        <div style={{ marginBottom: 14, display: "grid", gap: 8 }}>
          <Skeleton width={200} height={14} />
        </div>
      )}
      {status === "connected" && (
        <p className="mono" style={{ color: "var(--grn)", fontSize: 13, marginBottom: 14 }}>
          connected as {account}
        </p>
      )}
      {status === "expired" && (
        <p className="err" style={{ marginBottom: 14 }}>
          session expired — paste a fresh ssid cookie below.
        </p>
      )}

      <div className="field">
        <label htmlFor="ssid">ssid cookie</label>
        <textarea
          id="ssid"
          value={ssid}
          onChange={(e) => setSsid(e.target.value)}
          placeholder="paste your ssid cookie value"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="row">
        <Button onClick={connect} disabled={busy}>
          {busy ? "connecting…" : "connect"}
        </Button>
      </div>
      {err && <p className="err">{err}</p>}
      <SsidGuide />
    </Card>
  );
}
