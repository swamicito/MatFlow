import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listProducts, getSalesStats } from "@/app/(dashboard)/settings/sell/actions";
import { SellAdmin } from "@/components/sell/sell-admin";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const [productsRes, statsRes] = await Promise.all([
    listProducts(false),
    getSalesStats(),
  ]);

  if (!productsRes.ok) {
    const isMissing =
      productsRes.error.includes("products") ||
      productsRes.error.includes("relation");
    return (
      <div className="space-y-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {isMissing ? (
            <>
              Shop tables are missing. Apply{" "}
              <code className="text-white">
                supabase/migrations/0008_shop.sql
              </code>{" "}
              and reload.
            </>
          ) : (
            productsRes.error
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Products & Sales
        </h1>
        <p className="text-sm text-[#aaa] mt-1">
          Drop-ins, class packs, private sessions, gift cards, and specials.
          Students purchase online or you record a manual sale.
        </p>
      </header>

      <SellAdmin
        initialProducts={productsRes.data}
        stats={statsRes.ok ? statsRes.data : null}
      />
    </div>
  );
}
