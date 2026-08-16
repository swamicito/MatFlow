"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Mail, Zap, ArrowRight } from "lucide-react";
import { getSignupSessionInfo, type SessionInfo } from "./actions";

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro:     "Pro",
  growth:  "Growth",
};

const INTERVAL_LABEL: Record<string, string> = {
  monthly: "monthly",
  annual:  "annual",
};

export default function ConfirmedContent() {
  const searchParams = useSearchParams();
  const sessionId    = searchParams.get("session_id");

  const [info, setInfo] = useState<SessionInfo>({
    gymName:    null,
    ownerEmail: null,
    plan:       null,
    interval:   null,
  });

  useEffect(() => {
    if (!sessionId) return;

    getSignupSessionInfo(sessionId)
      .then((data) => {
        if (data) setInfo(data);
      })
      .catch((err) => {
        console.error("[confirmed] Failed to load session info:", err);
      });
  }, [sessionId]);

  const { gymName, ownerEmail, plan, interval } = info;

  return (
    <div
      style={{ minHeight: "100vh", background: "#000" }}
      className="flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-lg space-y-8">

        {/* Success icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full border-2 flex items-center justify-center"
               style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)" }}>
            <CheckCircle2 style={{ color: "#34d399", width: 40, height: 40 }} />
          </div>
        </div>

        {/* Headline */}
        <div className="text-center space-y-3">
          <h1 style={{ color: "#fff", fontSize: "1.875rem", fontWeight: 700 }}>
            You&apos;re all set!
          </h1>
          <p style={{ color: "#9CA3AF", lineHeight: 1.65 }}>
            {gymName ? (
              <>
                <span style={{ color: "#fff", fontWeight: 600 }}>{gymName}</span>
                {" "}is being provisioned automatically.{" "}
              </>
            ) : null}
            Check your inbox — your login link is on its way.
          </p>
        </div>

        {/* Details card */}
        <div style={{ borderRadius: 16, border: "1px solid #1f1f1f", background: "#0d0d0d" }}>

          {ownerEmail && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: "1px solid #1a1a1a" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #1f1f1f", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Mail style={{ width: 14, height: 14, color: "#6B7280" }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", margin: 0 }}>
                  Login link sent to
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                  {ownerEmail}
                </p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: ownerEmail || plan ? "1px solid #1a1a1a" : undefined }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #1f1f1f", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Zap style={{ width: 14, height: 14, color: "#34d399" }} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", margin: 0 }}>
                Provisioning
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                Automatic — login link sent within minutes
              </p>
            </div>
          </div>

          {plan && (
            <div style={{ padding: "16px 20px" }}>
              <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555", margin: "0 0 4px" }}>
                Plan selected
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                {PLAN_LABEL[plan] ?? plan}
                {interval ? ` · ${INTERVAL_LABEL[interval] ?? interval}` : ""}
                {" · 30-day free trial"}
              </p>
            </div>
          )}
        </div>

        {/* What happens next */}
        <div style={{ borderRadius: 16, border: "1px solid #1f1f1f", background: "#0d0d0d", padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 16px" }}>
            What happens next
          </h2>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              ownerEmail
                ? `Check your inbox at ${ownerEmail} (and your spam folder) for the login link.`
                : "Check your inbox for the login link — no password needed.",
              "Click the link to land directly in your MatFlow dashboard.",
              "Walk through a 2-minute setup wizard to configure your gym details.",
              "Embed your schedule on your website, import students, and go live.",
            ].map((step, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{
                  marginTop: 2, width: 20, height: 20, flexShrink: 0, borderRadius: "50%",
                  background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)",
                  fontSize: 10, fontWeight: 700, color: "#4ade80",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.6 }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Questions */}
        <p style={{ textAlign: "center", fontSize: 14, color: "#555" }}>
          Questions?{" "}
          <a href="mailto:support@mat-flow.net" style={{ color: "#4ade80", textDecoration: "none" }}>
            support@mat-flow.net
          </a>
        </p>

        {/* Back link */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link
            href="/"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#555", textDecoration: "none" }}
          >
            <ArrowRight style={{ width: 12, height: 12, transform: "rotate(180deg)" }} />
            Back to mat-flow.net
          </Link>
        </div>

      </div>
    </div>
  );
}
