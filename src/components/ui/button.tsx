"use client";

import React, { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      loadingText,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isEffectivelyDisabled = disabled || isLoading;

    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sparehub-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed select-none active:scale-[0.98]";

    const variantStyles = {
      primary:
        "bg-sparehub-orange text-white hover:bg-sparehub-orange-hover disabled:bg-sparehub-orange/60 shadow-sm",
      secondary:
        "bg-sparehub-dark text-white hover:bg-sparehub-dark-muted disabled:bg-sparehub-dark/60 shadow-sm",
      outline:
        "border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light disabled:bg-sparehub-light disabled:text-gray-400",
      ghost:
        "text-sparehub-dark hover:bg-sparehub-light disabled:text-gray-400",
      danger:
        "bg-sparehub-error text-white hover:bg-red-700 disabled:bg-sparehub-error/60 shadow-sm",
    };

    const sizeStyles = {
      sm: "text-xs px-3 py-1.5 gap-1.5 h-8",
      md: "text-sm px-4 py-2 gap-2 h-10",
      lg: "text-base px-6 py-3 gap-2.5 h-12 font-semibold",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isEffectivelyDisabled}
        aria-busy={isLoading}
        aria-disabled={isEffectivelyDisabled}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {isLoading && loadingText ? loadingText : children}
      </button>
    );
  }
);

Button.displayName = "Button";
