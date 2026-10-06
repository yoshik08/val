import type { ReactNode } from "react";
import Button from "./Button";

export default function Banner({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "warn";
  children: ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className={`banner ${tone}`} role="alert">
      <span>{children}</span>
      {action && (
        <a href={action.href} style={{ textDecoration: "none" }}>
          <Button variant="ghost" style={{ padding: "8px 16px" }}>
            {action.label}
          </Button>
        </a>
      )}
    </div>
  );
}
