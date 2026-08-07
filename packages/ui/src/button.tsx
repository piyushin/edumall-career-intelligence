import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({ children, className = "", variant = "primary", ...props }: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? "bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-blue-700"
      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-600";

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
