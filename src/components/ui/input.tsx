"use client";

import React, { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-sparehub-dark"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            className={cn(
              "w-full rounded-lg border border-sparehub-border bg-white px-3.5 py-2.5 text-sm text-sparehub-dark transition-colors",
              "placeholder:text-gray-400",
              "focus-visible:outline-none focus-visible:border-sparehub-orange focus-visible:ring-2 focus-visible:ring-sparehub-orange/20",
              "disabled:bg-sparehub-light disabled:cursor-not-allowed disabled:text-gray-400",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-sparehub-error focus-visible:border-sparehub-error focus-visible:ring-sparehub-error/20",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-sparehub-error">{error}</p>}
        {!error && helperText && <p className="text-xs text-gray-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
