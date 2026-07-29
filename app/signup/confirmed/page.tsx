import { Suspense } from "react";
import type { Metadata } from "next";
import ConfirmedContent from "./confirmed-content";

export const metadata: Metadata = { title: "You're all set · MatFlow" };

// Static loading shell shown while the client component hydrates.
function LoadingShell() {
  return (
    <div
      style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <p style={{ color: "#555", fontSize: 14 }}>Loading…</p>
    </div>
  );
}

export default function SignupConfirmedPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <ConfirmedContent />
    </Suspense>
  );
}
