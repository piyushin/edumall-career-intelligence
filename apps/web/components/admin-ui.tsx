"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@edumall/ui";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const tone =
    normalized.includes("ACTIVE") ||
    normalized.includes("SUCCEEDED") ||
    normalized.includes("SENT") ||
    normalized.includes("RELEASED")
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : normalized.includes("SUSPEND") ||
          normalized.includes("FAILED") ||
          normalized.includes("REVOK") ||
          normalized.includes("CANCEL")
        ? "bg-red-50 text-red-700 ring-red-600/20"
        : normalized.includes("BLOCKED") ||
            normalized.includes("PENDING") ||
            normalized.includes("INVITED")
          ? "bg-amber-50 text-amber-800 ring-amber-600/20"
          : "bg-slate-100 text-slate-700 ring-slate-500/20";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success" | "warning" | "info";
}) {
  const classes = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${classes[tone]}`}
    >
      {children}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-label="Loading" aria-busy="true" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Alert>
      <p className="font-semibold">Unable to load this workspace</p>
      <p className="mt-1">{message}</p>
      <Button variant="secondary" className="mt-3" onClick={retry}>
        Retry
      </Button>
    </Alert>
  );
}

export function CursorPagination({
  canGoBack,
  hasNext,
  onBack,
  onNext,
}: {
  canGoBack: boolean;
  hasNext: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <Button variant="secondary" disabled={!canGoBack} onClick={onBack}>
        Previous
      </Button>
      <Button variant="secondary" disabled={!hasNext} onClick={onNext}>
        Next
      </Button>
    </nav>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100";

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="admin-modal-title" className="text-xl font-semibold text-slate-950">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  impact,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  impact: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} title={title} description={impact} onClose={onCancel}>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
