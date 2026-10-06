"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bp } from "@/lib/basePath";
import { useApi } from "@/lib/use-api";
import Button from "./ui/Button";
import type { Account } from "@/lib/types";

type MeData = {
  accounts?: (Account & { id?: string })[];
};

/** event fired after a successful account switch so data components refetch */
export const ACCOUNT_CHANGED_EVENT = "val:account-changed";

export default function AccountSwitcher() {
  const router = useRouter();
  const { status, data, reload } = useApi<MeData>("/api/me");
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [ssid, setSsid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accounts = status === "ok" ? data?.accounts ?? [] : [];
  const active = accounts.find((a) => a.active) || accounts[0];
  const riotId = active?.gameName
    ? `${active.gameName}#${active.tagLine || ""}`
    : "switch accounts";

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const switchAccount = async (accountId?: string) => {
    if (!accountId || accountId === active?.id) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(bp("/api/riot/switch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) return;
      setOpen(false);
      await reload();
      // tell dashboard data components to refetch (no page reload)
      window.dispatchEvent(
        new CustomEvent(ACCOUNT_CHANGED_EVENT, { detail: { accountId } })
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const addAccount = async () => {
    const v = ssid.trim();
    if (!v) {
      setErr("paste your ssid first");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(bp("/api/riot/connect"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid: v }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error || `connect failed: ${res.status}`);
        return;
      }
      const newId: string | undefined = d?.account?.id;
      setSsid("");
      setShowAdd(false);
      setOpen(false);
      await reload();
      window.dispatchEvent(
        new CustomEvent(ACCOUNT_CHANGED_EVENT, { detail: { accountId: newId } })
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return null;
  if (accounts.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative" }}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        className="acct on"
        style={{
          cursor: "pointer",
          background: "none",
          border: "none",
          font: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
        data-hover
      >
        {riotId} <span style={{ fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 230,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 6,
            zIndex: 50,
            boxShadow: "0 12px 32px rgba(0,0,0,.45)",
          }}
        >
          {accounts.map((a) => {
            const name = a.gameName ? `${a.gameName}#${a.tagLine || ""}` : "account";
            const isActive = a.id === active?.id;
            return (
              <button
                key={a.id || name}
                onClick={() => switchAccount(a.id)}
                disabled={busy}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: isActive ? "var(--hover)" : "none",
                  color: "inherit",
                  font: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                data-hover
              >
                <span>{name}</span>
                {isActive && <span style={{ fontSize: 12 }}>✓</span>}
              </button>
            );
          })}
          <button
            onClick={() => {
              setOpen(false);
              setShowAdd(true);
              setErr("");
            }}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background: "none",
              color: "var(--accent)",
              font: "inherit",
              cursor: "pointer",
              marginTop: 4,
              borderTop: "1px solid var(--border)",
              paddingTop: 10,
            }}
            data-hover
          >
            <span style={{ fontSize: 16 }}>+</span> add account
          </button>
        </div>
      )}

      {showAdd && (
        <div
          onClick={() => !busy && setShowAdd(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 20,
              width: "100%",
              maxWidth: 440,
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>add riot account</h3>
            <p className="dim" style={{ fontSize: 13, margin: "0 0 12px" }}>
              paste the ssid for the account you want to add. it gets linked to
              your google login.
            </p>
            <textarea
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="paste ssid cookie value"
              rows={3}
              disabled={busy}
              style={{ width: "100%", marginBottom: 10 }}
            />
            {err && (
              <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 10px" }}>
                {err}
              </p>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setShowAdd(false)} disabled={busy}>
                cancel
              </Button>
              <Button onClick={addAccount} disabled={busy}>
                {busy ? "connecting…" : "connect"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
