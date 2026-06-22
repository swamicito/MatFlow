"use client";

import { useState } from "react";
import { Check, Copy, Code2 } from "lucide-react";

function buildEmbedCode(slug: string, siteUrl: string) {
  return (
    `<iframe id="mf-schedule" src="${siteUrl}/embed/schedule/${slug}" width="100%" frameborder="0" style="border:none; display:block; min-height:400px;" title="Class Schedule"></iframe>\n` +
    `<script>window.addEventListener('message',function(e){if(e.data&&e.data.type==='mf-height'){document.getElementById('mf-schedule').style.height=e.data.height+'px';}});</script>`
  );
}

export function ScheduleEmbedCard({
  gymSlug,
  gymName,
  siteUrl,
}: {
  gymSlug: string;
  gymName: string;
  siteUrl: string;
}) {
  const embedCode = buildEmbedCode(gymSlug, siteUrl);
  const previewUrl = `${siteUrl}/embed/schedule/${gymSlug}`;

  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / blocked clipboard access
      const ta = document.createElement("textarea");
      ta.value = embedCode;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 grid place-items-center rounded-md border border-[#222] bg-black shrink-0">
          <Code2 className="h-5 w-5 text-[#ccc]" />
        </div>
        <div className="space-y-1 flex-1">
          <h2 className="text-base font-semibold text-white">
            Public Schedule Embed
          </h2>
          <p className="text-sm text-[#aaa]">
            Paste this code into any page on your website. The schedule stays
            up to date automatically.
          </p>
        </div>
      </div>

      {/* Slug badge + preview link */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-[#222] bg-black text-xs text-[#888]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {gymName}
        </span>
        <span className="text-xs text-[#444]">·</span>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#555] hover:text-white transition-colors underline underline-offset-2"
        >
          Preview embed ↗
        </a>
      </div>

      {/* Code block */}
      <div className="relative group">
        <pre className="overflow-x-auto rounded-lg border border-[#1a1a1a] bg-[#060606] p-4 text-[11px] leading-relaxed text-[#9CA3AF] whitespace-pre scrollbar-thin">
          {embedCode}
        </pre>

        {/* Copy button — overlays top-right of the code block */}
        <button
          onClick={handleCopy}
          aria-label="Copy embed code"
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[#222] bg-[#111] text-[11px] font-medium transition-colors hover:border-[#333] hover:bg-[#1a1a1a]"
          style={{ color: copied ? "#34D399" : "#9CA3AF" }}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy Code
            </>
          )}
        </button>
      </div>

      {/* Instructions */}
      <p className="text-xs text-[#444] leading-relaxed">
        <span className="text-[#666]">Webflow:</span> Add an{" "}
        <span className="font-mono text-[#555]">Embed</span> element, paste the
        code, and publish. The iframe auto-sizes to fit your schedule.
      </p>
    </section>
  );
}
