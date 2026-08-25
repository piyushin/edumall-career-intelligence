import React, { type ButtonHTMLAttributes, type ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({ children, className = "", variant = "primary", ...props }: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
      : "border border-slate-300 bg-white text-slate-900 hover:bg-orange-50 focus-visible:ring-orange-500";

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
