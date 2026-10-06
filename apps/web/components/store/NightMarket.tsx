"use client";

import { useState } from "react";
import { useApi } from "@/lib/use-api";
import type { StoreData } from "@/lib/types";
import Card from "../ui/Card";
import Countdown from "../Countdown";
import { OfferSkeleton } from "../ui/Skeleton";

export default function NightMarket() {
  const { status, data, error } = useApi<StoreData>("/api/store");

  const nm = status === "ok" ? data?.nightMarket : undefined;

  // render nothing at all when the night market is not in the rotation
  if (status === "ok" && !nm) return null;

  return (
    <Card
      title="night market"
      right={status === "ok" && nm ? <Countdown expiresIn={nm.expiresIn} /> : undefined}
    >
      {status === "loading" && (
        <div className="grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <OfferSkeleton key={i} />
          ))}
        </div>
      )}
      {status === "error" && <p className="err">{error?.message}</p>}
      {status === "ok" && nm && (!nm.offers || nm.offers.length === 0) && (
        <p className="dim">night market is active but has no offers.</p>
      )}
      {status === "ok" && nm && nm.offers && nm.offers.length > 0 && (
        <div className="grid">
          {nm.offers.map((o, i) => {
            const key = o.offerId ?? o.uuid ?? `${o.name}-${i}`;
            return (
              <NightMarketCard key={key} offer={o} />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function NightMarketCard({ offer }: { offer: NonNullable<StoreData["nightMarket"]>["offers"][number] }) {
  const [src, setSrc] = useState<string | undefined>(offer.icon);
  const [queue, setQueue] = useState<string[]>(offer.fallbacks ?? []);
  const [imgGone, setImgGone] = useState(false);

  const onError = () => {
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setSrc(next);
      setQueue(rest);
    } else {
      setImgGone(true);
    }
  };

  const price = offer.discountPrice ?? offer.price;

  return (
    <div className="offer-wrap">
      {offer.discountPercent != null && (
        <span className="discount-badge">-{offer.discountPercent}%</span>
      )}
      <div className="offer">
        {!imgGone && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="offer-img"
            src={src}
            alt={offer.name}
            loading="lazy"
            onError={onError}
          />
        ) : null}
        <div className="info">
          <div className="name">{offer.name}</div>
          {offer.weapon && <div className="weapon">{offer.weapon}</div>}
          <div className="price">
            {offer.price != null && (
              <span className="price-old">
                {offer.price.toLocaleString("en-IN")} VP
              </span>
            )}
            {price != null ? `${price.toLocaleString("en-IN")} VP` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
