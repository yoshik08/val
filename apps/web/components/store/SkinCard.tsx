"use client";

import { useState } from "react";
import type { StoreOffer } from "@/lib/types";

export default function SkinCard({ offer }: { offer: StoreOffer }) {
  const [src, setSrc] = useState<string | undefined>(offer.icon);
  const [queue, setQueue] = useState<string[]>(offer.fallbacks ?? []);
  const [imgGone, setImgGone] = useState(false);

  const onError = () => {
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setSrc(next);
      setQueue(rest);
    } else {
      // fallback chain exhausted — hide gracefully like the original app
      setImgGone(true);
    }
  };

  return (
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
          {offer.price != null ? `${offer.price.toLocaleString("en-IN")} VP` : "—"}
        </div>
      </div>
    </div>
  );
}
