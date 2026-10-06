import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  children: ReactNode;
};

export default function Button({
  variant = "primary",
  children,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`btn${variant === "ghost" ? " ghost" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
