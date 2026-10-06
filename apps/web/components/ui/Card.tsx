import type { ReactNode } from "react";

export default function Card({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-title">
          <span>{title}</span>
          {right && <span className="right mono">{right}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
