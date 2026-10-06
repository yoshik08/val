export default function Skeleton({
  width = "100%",
  height = 14,
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function OfferSkeleton() {
  return (
    <div className="offer">
      <Skeleton height={110} />
      <div className="info">
        <Skeleton height={14} width="80%" />
        <div style={{ marginTop: 8 }}>
          <Skeleton height={12} width="50%" />
        </div>
        <div style={{ marginTop: 10 }}>
          <Skeleton height={14} width="40%" />
        </div>
      </div>
    </div>
  );
}
