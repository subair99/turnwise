"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending, className = "btn" }: { children: string; pending: string; className?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={busy} aria-live="polite">
      {busy ? pending : children}
    </button>
  );
}
