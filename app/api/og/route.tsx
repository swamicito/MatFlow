import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const logoData = await readFile(
    join(process.cwd(), "public", "logo-full.png"),
  );
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          backgroundColor: "#080808",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 100px",
          position: "relative",
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: -60,
            left: 200,
            right: 200,
            height: 280,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.05) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Logo */}
        <img
          src={logoSrc}
          width={200}
          height={50}
          style={{ objectFit: "contain", marginBottom: 40 }}
        />

        {/* Category badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "6px 16px",
            borderRadius: 100,
            border: "1px solid #222222",
            backgroundColor: "#0d0d0d",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: "#10b981",
              marginRight: 8,
            }}
          />
          <span
            style={{
              color: "#9CA3AF",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
            }}
          >
            GYM MANAGEMENT PLATFORM
          </span>
        </div>

        {/* Headline line 1 */}
        <span
          style={{
            fontSize: 66,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
            textAlign: "center",
            display: "flex",
          }}
        >
          Stop Running Your Gym
        </span>

        {/* Headline line 2 */}
        <span
          style={{
            fontSize: 66,
            fontWeight: 800,
            color: "#6B7280",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            textAlign: "center",
            marginBottom: 28,
            display: "flex",
          }}
        >
          From Your DMs
        </span>

        {/* Subheadline */}
        <span
          style={{
            fontSize: 20,
            color: "#6B7280",
            textAlign: "center",
            maxWidth: 640,
            lineHeight: 1.5,
            marginBottom: 44,
            display: "flex",
          }}
        >
          Class scheduling, student sign-ups, Stripe payments, and a beautiful
          embeddable schedule — in one platform.
        </span>

        {/* Feature pills */}
        <div style={{ display: "flex" }}>
          <div
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid #1f1f1f",
              backgroundColor: "#111111",
              color: "#6B7280",
              fontSize: 14,
              fontWeight: 500,
              marginRight: 10,
            }}
          >
            📅 Class Scheduling
          </div>
          <div
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid #1f1f1f",
              backgroundColor: "#111111",
              color: "#6B7280",
              fontSize: 14,
              fontWeight: 500,
              marginRight: 10,
            }}
          >
            💳 Stripe Payments
          </div>
          <div
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid #1f1f1f",
              backgroundColor: "#111111",
              color: "#6B7280",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ⚡ Embeddable Schedule
          </div>
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: "#10b981",
              marginRight: 8,
            }}
          />
          <span style={{ color: "#333333", fontSize: 13 }}>mat-flow.net</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
