"use client";

import { useApi } from "@/lib/use-api";
import type { WalletData } from "@/lib/types";
import Card from "../ui/Card";
import Skeleton from "../ui/Skeleton";

export default function WalletBar() {
  const { status, data } = useApi<WalletData>("/api/wallet");

  const vp = data?.vp ?? null;
  const radianite = data?.radianite ?? null;

  return (
    <Card title="wallet">
      <div className="wallet-bar">
        <div className="wallet-item">
          <span className="label">vp</span>
          {status === "loading" ? (
            <Skeleton width={80} height={24} />
          ) : (
            <span className="val">
              {vp != null ? vp.toLocaleString("en-IN") : "—"}
            </span>
          )}
        </div>
        <div className="wallet-item">
          <span className="label">radianite</span>
          {status === "loading" ? (
            <Skeleton width={60} height={24} />
          ) : (
            <span className="val">
              {radianite != null ? radianite.toLocaleString("en-IN") : "—"}
            </span>
          )}
        </div>
        {status === "error" && (
          <span className="dim">wallet unavailable right now</span>
        )}
      </div>
    </Card>
  );
}
