"use client";

import { useApi } from "@/lib/use-api";
import type { StoreData } from "@/lib/types";
import Card from "../ui/Card";
import Countdown from "../Countdown";
import SkinCard from "./SkinCard";
import { OfferSkeleton } from "../ui/Skeleton";

export default function DailyStore() {
  const { status, data, error } = useApi<StoreData>("/api/store");

  return (
    <Card
      title="daily shop"
      right={status === "ok" && data?.daily ? <Countdown expiresIn={data.daily.expiresIn} /> : undefined}
    >
      {status === "loading" && (
        <div className="grid">
          {[0, 1, 2, 3].map((i) => (
            <OfferSkeleton key={i} />
          ))}
        </div>
      )}
      {status === "error" && <p className="err">{error?.message}</p>}
      {status === "ok" && (!data?.daily?.offers?.length) && (
        <p className="dim">no offers in the daily shop right now.</p>
      )}
      {status === "ok" && !!data?.daily?.offers?.length && (
        <div className="grid">
          {data.daily.offers.map((o, i) => (
            <SkinCard key={o.offerId ?? o.uuid ?? `${o.name}-${i}`} offer={o} />
          ))}
        </div>
      )}
    </Card>
  );
}
