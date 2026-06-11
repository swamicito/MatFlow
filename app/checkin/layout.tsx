import type { ReactNode } from "react";

/**
 * Bare layout — no dashboard chrome. The tablet check-in screen is a
 * full-bleed surface with its own header.
 */
export default function CheckinLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
