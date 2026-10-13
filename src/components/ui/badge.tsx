import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "orange" | "neutral" | "success" | "error" | "demo";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    orange: "bg-sparehub-orange-light text-sparehub-orange border border-sparehub-orange/20",
    neutral: "bg-sparehub-light text-sparehub-dark border border-sparehub-border",
    success: "bg-green-50 text-sparehub-success border border-green-200",
    error: "bg-red-50 text-sparehub-error border border-red-200",
    demo: "bg-amber-50 text-amber-800 border border-amber-300 font-mono tracking-wider",
  };

  const sizeStyles = {
    sm: "text-xs px-2 py-0.5 rounded",
    md: "text-xs px-2.5 py-1 rounded-md font-medium",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors select-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
