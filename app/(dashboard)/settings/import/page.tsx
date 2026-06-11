import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportClient } from "@/components/import/import-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import from Mindbody · MatFlow" };

export default function ImportPage() {
  return (
    <div className="space-y-2">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>
      <ImportClient />
    </div>
  );
}
