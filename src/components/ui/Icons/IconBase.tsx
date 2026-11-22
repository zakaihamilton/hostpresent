import type { ReactNode } from "react";

export type IconProps = { size?: number; className?: string };

export function Icon({
  size = 20,
  className,
  title,
  children,
}: IconProps & {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <title>{title || "Icon"}</title>
      {children}
    </svg>
  );
}
