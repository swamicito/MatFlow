"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseCsvWithHeaders } from "@/lib/import/csv";
import {
  FIELDS,
  FIELD_BY_KEY,
  autoMapField,
  type FieldKey,
} from "@/lib/import/schema";
import {
  runImport,
  type ImportResult,
  type Mapping,
  type MatchReason,
} from "@/app/(dashboard)/settings/import/actions";
import { cn } from "@/lib/utils";

type Step = "upload" | "map" | "preview" | "done";
type ImportMode = "all" | "new_only" | "update_only";

const STEP_LABEL: Record<Step, string> = {
  upload: "Upload",
  map: "Map columns",
  preview: "Preview",
  done: "Done",
};

const STEP_ORDER: Step[] = ["upload", "map", "preview", "done"];

export function ImportClient() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [importMode, setImportMode] = useState<ImportMode>("all");
  const [skipIndices, setSkipIndices] = useState<Set<number>>(new Set());
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [finalResult, setFinalResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [progressLabel, setProgressLabel] = useState<string>("");

  function reset() {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRecords([]);
    setMapping({});
    setImportMode("all");
    setSkipIndices(new Set());
    setParseError(null);
    setPreview(null);
    setFinalResult(null);
    setProgressLabel("");
  }

  async function handleFile(f: File) {
    setParseError(null);
    setFile(f);
    if (f.size > 8 * 1024 * 1024) {
      setParseError("File is larger than 8 MB. Split it into smaller chunks.");
      return;
    }
    const text = await f.text();
    try {
      const { headers: hdrs, records: rs } = parseCsvWithHeaders(text);
      if (hdrs.length === 0) {
        setParseError("No header row found in this CSV.");
        return;
      }
      if (rs.length === 0) {
        setParseError("CSV has a header but no data rows.");
        return;
      }
      const auto: Mapping = {};
      for (const h of hdrs) auto[h] = autoMapField(h);
      setHeaders(hdrs);
      setRecords(rs);
      setMapping(auto);
      setSkipIndices(new Set());
      setStep("map");
    } catch {
      setParseError("Could not parse this file as CSV.");
    }
  }

  function changeMapping(header: string, key: FieldKey) {
    setMapping((m) => ({ ...m, [header]: key }));
  }

  function toggleSkip(idx: number) {
    setSkipIndices((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function runDryRun() {
    setProgressLabel("Validating rows…");
    startTransition(async () => {
      const r = await runImport({
        headers,
        rows: records,
        mapping,
        skipIndices: Array.from(skipIndices),
        importMode,
        dryRun: true,
      });
      setPreview(r);
      setStep("preview");
      setProgressLabel("");
    });
  }

  function runExecute() {
    setProgressLabel(`Importing ${records.length} students…`);
    startTransition(async () => {
      const r = await runImport({
        headers,
        rows: records,
        mapping,
        skipIndices: Array.from(skipIndices),
        importMode,
        dryRun: false,
      });
      setFinalResult(r);
      setStep("done");
      setProgressLabel("");
    });
  }

  return (
    <div className="space-y-8">
      <ImportProgressBar active={pending} />

      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Import from Mindbody
          </h1>
          <p className="text-sm text-[#aaa] mt-1">
            Upload a CSV exported from Mindbody (Clients, Members, or Pricing
            Options). MatFlow auto-detects columns, lets you preview every
            row, and only writes after you confirm.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/import/sample"
            download
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-[#222] text-sm text-[#ccc] hover:bg-[#111] hover:text-white transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Sample CSV
          </a>
          {step !== "upload" && (
            <Button
              variant="outline"
              onClick={reset}
              className="border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Start over
            </Button>
          )}
        </div>
      </header>

      <Stepper current={step} />

      {step === "upload" && (
        <UploadStep onFile={handleFile} parseError={parseError} />
      )}

      {step === "map" && (
        <MapStep
          file={file}
          headers={headers}
          records={records}
          mapping={mapping}
          importMode={importMode}
          onImportModeChange={setImportMode}
          onChange={changeMapping}
          onBack={() => setStep("upload")}
          onNext={runDryRun}
          pending={pending}
        />
      )}

      {step === "preview" && preview && (
        <PreviewStep
          preview={preview}
          skipIndices={skipIndices}
          onToggleSkip={toggleSkip}
          onBack={() => setStep("map")}
          onConfirm={runExecute}
          onRePreview={runDryRun}
          pending={pending}
        />
      )}

      {step === "done" && finalResult && (
        <DoneStep result={finalResult} onReset={reset} />
      )}

      {pending && progressLabel && (
        <div className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-xl border border-[#222] bg-[#0a0a0a] px-4 py-2.5 text-sm text-[#ccc] shadow-xl shadow-black/40 z-50">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
          <span className="text-white/80 text-xs">{progressLabel}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────── Progress bar ───────────────────

function ImportProgressBar({ active }: { active: boolean }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!active) {
      if (width > 0) {
        setWidth(100);
        const t = setTimeout(() => setWidth(0), 600);
        return () => clearTimeout(t);
      }
      return;
    }
    setWidth(8);
    const interval = setInterval(() => {
      setWidth((w) => (w >= 88 ? 88 : w + (88 - w) * 0.07));
    }, 250);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (width === 0) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] bg-[#111]">
      <div
        className="h-full bg-white transition-[width] duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ─────────────────── Stepper ───────────────────

function Stepper({ current }: { current: Step }) {
  const idx = STEP_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
      {STEP_ORDER.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={s} className="inline-flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center justify-center h-6 w-6 rounded-full border text-[10px] font-semibold",
                active && "border-white bg-white text-black",
                done && "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
                !active && !done && "border-[#333] text-[#666]",
              )}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "tracking-widest",
                active ? "text-white" : done ? "text-[#aaa]" : "text-[#555]",
              )}
            >
              {STEP_LABEL[s]}
            </span>
            {i < STEP_ORDER.length - 1 && (
              <span className="mx-2 h-px w-8 bg-[#222]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────── Step 1: Upload ───────────────────

function UploadStep({
  onFile,
  parseError,
}: {
  onFile: (f: File) => void;
  parseError: string | null;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  }

  function drop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
      <CardContent className="p-8">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={drop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "cursor-pointer rounded-lg border border-dashed p-12 text-center transition-colors",
            drag
              ? "border-white bg-[#111]"
              : "border-[#333] hover:border-[#555] hover:bg-[#0d0d0d]",
          )}
        >
          <div className="mx-auto h-14 w-14 grid place-items-center rounded-full border border-[#222] bg-black mb-4">
            <Upload className="h-6 w-6 text-white" />
          </div>
          <p className="text-base font-medium text-white">
            Drop a CSV file here, or click to browse
          </p>
          <p className="text-xs text-[#888] mt-1">
            Up to 8 MB · UTF-8 · headers in the first row
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={pick}
            className="hidden"
          />
        </div>

        {parseError && (
          <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-2 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {parseError}
          </div>
        )}

        <ExpectedColumnsHelp />
      </CardContent>
    </Card>
  );
}

function ExpectedColumnsHelp() {
  const groups = [
    {
      label: "Identity",
      items: ["Full Name (or First + Last)", "Email", "Phone", "Date of Birth"],
    },
    {
      label: "Membership",
      items: ["Status", "Join Date", "Membership Plan", "Price", "Custom Price"],
    },
    { label: "Belt", items: ["Belt Rank", "Stripes"] },
    { label: "Other", items: ["Notes"] },
  ];

  return (
    <details className="mt-6 group">
      <summary className="text-sm text-[#aaa] hover:text-white cursor-pointer inline-flex items-center gap-2 select-none">
        <Sparkles className="h-3.5 w-3.5" />
        What columns does MatFlow expect?
      </summary>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {groups.map((g) => (
          <div
            key={g.label}
            className="rounded-md border border-[#1f1f1f] bg-black p-3"
          >
            <p className="text-xs uppercase tracking-widest text-[#666] mb-2">
              {g.label}
            </p>
            <ul className="space-y-1 text-sm text-[#ccc]">
              {g.items.map((i) => (
                <li key={i}>· {i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#666]">
        Common Mindbody column names (e.g. <code>First Name</code>,{" "}
        <code>Pricing Option</code>, <code>Member Since</code>) are auto-mapped.
        You can override every mapping in the next step.
      </p>
    </details>
  );
}

// ─────────────────── Step 2: Mapping ───────────────────

function ImportModeSelector({
  value,
  onChange,
}: {
  value: ImportMode;
  onChange: (v: ImportMode) => void;
}) {
  const options: { key: ImportMode; label: string; desc: string }[] = [
    { key: "all", label: "New & Existing", desc: "Create new students and update matches" },
    { key: "new_only", label: "New Students Only", desc: "Skip rows that match existing students" },
    { key: "update_only", label: "Updates Only", desc: "Skip rows with no existing match" },
  ];
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-black p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[#555]">Import Mode</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-left transition-all",
              value === o.key
                ? "border-white bg-white/5 text-white"
                : "border-[#1f1f1f] text-[#666] hover:border-[#2a2a2a] hover:text-[#aaa]",
            )}
          >
            <p className="text-xs font-semibold">{o.label}</p>
            <p className="text-[10px] mt-0.5 opacity-70">{o.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function MapStep({
  file,
  headers,
  records,
  mapping,
  importMode,
  onImportModeChange,
  onChange,
  onBack,
  onNext,
  pending,
}: {
  file: File | null;
  headers: string[];
  records: Record<string, string>[];
  mapping: Mapping;
  importMode: ImportMode;
  onImportModeChange: (v: ImportMode) => void;
  onChange: (header: string, key: FieldKey) => void;
  onBack: () => void;
  onNext: () => void;
  pending: boolean;
}) {
  const previewRows = records.slice(0, 5);

  // Quick validation: full_name OR (first_name + last_name) must be mapped.
  const mappedFields = new Set(Object.values(mapping));
  const hasName =
    mappedFields.has("full_name") ||
    (mappedFields.has("first_name") && mappedFields.has("last_name"));

  return (
    <div className="space-y-6">
      <FileChip file={file} />

      <ImportModeSelector value={importMode} onChange={onImportModeChange} />

      <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
        <CardContent className="p-0">
          <div className="px-6 pt-5 pb-3 flex items-baseline justify-between">
            <h2 className="text-base font-medium text-white">Column mapping</h2>
            <span className="text-xs uppercase tracking-widest text-[#666]">
              {headers.length} columns · {records.length} rows
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-[#1f1f1f] hover:bg-transparent">
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Mindbody column
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider w-[280px]">
                  MatFlow field
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Sample (first 3)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {headers.map((h) => {
                const samples = previewRows
                  .map((r) => r[h])
                  .filter((v) => v && v.length > 0)
                  .slice(0, 3);
                const cur = mapping[h] ?? "ignore";
                const def = FIELD_BY_KEY[cur];
                return (
                  <TableRow
                    key={h}
                    className="border-[#1f1f1f] hover:bg-[#0a0a0a]"
                  >
                    <TableCell className="font-medium text-white">
                      {h}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={cur}
                        onValueChange={(v) => v && onChange(h, v as FieldKey)}
                      >
                        <SelectTrigger className="bg-black border-[#222] text-white h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white max-h-72">
                          {FIELDS.map((f) => (
                            <SelectItem
                              key={f.key}
                              value={f.key}
                              className="focus:bg-[#111] focus:text-white"
                            >
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {def?.hint && cur !== "ignore" && (
                        <p className="text-[10px] text-[#666] mt-1">
                          {def.hint}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-[#aaa] font-mono text-xs">
                      {samples.length > 0 ? samples.join(" · ") : (
                        <span className="text-[#555]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {previewRows.length > 0 && (
            <div className="px-6 py-4 border-t border-[#1f1f1f]">
              <p className="text-xs uppercase tracking-widest text-[#666] mb-2">
                Raw preview (first 5)
              </p>
              <div className="overflow-x-auto">
                <table className="text-xs text-[#ccc] border-collapse">
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th
                          key={h}
                          className="text-left px-2 py-1 border-b border-[#1f1f1f] text-[#888] font-normal"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-b border-[#1a1a1a]">
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="px-2 py-1 max-w-[180px] truncate"
                          >
                            {r[h] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!hasName && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          You must map either <code className="font-mono">Full Name</code>, or
          both <code className="font-mono">First Name</code> and{" "}
          <code className="font-mono">Last Name</code>, before continuing.
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={pending || !hasName}
          className="bg-white text-black hover:bg-white/90"
        >
          {pending ? "Validating…" : "Preview Import"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────── Step 3: Preview ───────────────────

function PreviewStep({
  preview,
  skipIndices,
  onToggleSkip,
  onBack,
  onConfirm,
  onRePreview,
  pending,
}: {
  preview: import("@/app/(dashboard)/settings/import/actions").ImportResult;
  skipIndices: Set<number>;
  onToggleSkip: (idx: number) => void;
  onBack: () => void;
  onConfirm: () => void;
  onRePreview: () => void;
  pending: boolean;
}) {
  const t = preview.totals;
  const rowsWithErrors = preview.rows.filter((r) =>
    r.issues.some((x) => x.level === "error"),
  );
  const canExecute = !preview.fatal && t.creatable + t.updatable > 0;

  return (
    <div className="space-y-6">
      {preview.fatal && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Import blocked.</p>
            <p>{preview.fatal}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Will create" value={t.creatable} />
        <Stat label="Will update" value={t.updatable} />
        <Stat label="Skipped" value={t.skipped} />
        <Stat
          label="Errors"
          value={t.errors}
          highlight={t.errors > 0}
        />
      </div>

      <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
        <CardContent className="p-0">
          <div className="px-6 pt-5 pb-3 flex items-baseline justify-between">
            <h2 className="text-base font-medium text-white">
              Row-by-row preview
            </h2>
            <span className="text-xs uppercase tracking-widest text-[#666]">
              {preview.rows.length} rows
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[#1f1f1f] hover:bg-transparent">
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  #
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Action
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Email
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Belt
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Plan
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Issues
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Match
                </TableHead>
                <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
                  Skip
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((r) => {
                const willSkip = skipIndices.has(r.index) || r.action === "skip";
                const hasErr = r.issues.some((x) => x.level === "error");
                return (
                  <TableRow
                    key={r.index}
                    className={cn(
                      "border-[#1f1f1f] hover:bg-[#0a0a0a]",
                      willSkip && "opacity-50",
                      hasErr && "bg-red-500/5",
                    )}
                  >
                    <TableCell className="text-[#666] font-mono text-xs">
                      {r.index + 1}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={r.action} />
                    </TableCell>
                    <TableCell className="text-white">
                      {r.full_name ?? <span className="text-red-400">—</span>}
                    </TableCell>
                    <TableCell className="text-[#aaa]">
                      {r.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-[#aaa] capitalize">
                      {r.belt_rank ?? "white"}
                    </TableCell>
                    <TableCell className="text-[#aaa] capitalize">
                      {r.status ?? "active"}
                    </TableCell>
                    <TableCell className="text-[#aaa]">
                      {r.plan ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.issues.length === 0 ? (
                        <span className="text-[#555]">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {r.issues.map((iss, k) => (
                            <li
                              key={k}
                              className={cn(
                                "text-xs",
                                iss.level === "error"
                                  ? "text-red-300"
                                  : "text-amber-300",
                              )}
                            >
                              · {iss.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell>
                      <MatchReasonBadge reason={r.match_reason} />
                    </TableCell>
                    <TableCell className="text-right">
                      <input
                        type="checkbox"
                        checked={skipIndices.has(r.index)}
                        onChange={() => onToggleSkip(r.index)}
                        className="h-4 w-4 accent-white"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {rowsWithErrors.length > 0 && (
        <p className="text-xs text-[#888]">
          Rows with errors are auto-skipped. Tick the checkbox on any other row
          you don&apos;t want imported, then re-preview.
        </p>
      )}

      <div className="flex justify-between gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
        >
          Back to mapping
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onRePreview}
            disabled={pending}
            className="border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-preview
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending || !canExecute}
            className="bg-white text-black hover:bg-white/90"
          >
            {pending ? "Importing…" : "Start Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Step 4: Done ───────────────────

function DoneStep({
  result,
  onReset,
}: {
  result: ImportResult;
  onReset: () => void;
}) {
  const t = result.totals;
  const success = result.ok && !result.fatal;
  const errorRows = result.rows.filter((r) =>
    r.issues.some((x) => x.level === "error"),
  );

  return (
    <div className="space-y-6">
      <Card
        className={cn(
          "shadow-none",
          success
            ? "bg-emerald-500/5 border-emerald-500/40"
            : "bg-red-500/5 border-red-500/40",
        )}
      >
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-12 w-12 grid place-items-center rounded-full border",
                success
                  ? "border-emerald-500/50 text-emerald-300 bg-emerald-500/10"
                  : "border-red-500/50 text-red-300 bg-red-500/10",
              )}
            >
              {success ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <AlertCircle className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-white">
                {success ? "Import complete" : "Import finished with errors"}
              </h2>
              <p className="text-sm text-[#aaa] mt-1">
                {result.fatal ?? (
                  <>
                    Imported{" "}
                    <span className="text-white font-medium">{t.creatable}</span>{" "}
                    new and{" "}
                    <span className="text-white font-medium">{t.updatable}</span>{" "}
                    existing students.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <Stat label="Students created" value={t.creatable} />
            <Stat label="Students updated" value={t.updatable} />
            <Stat label="Plans created" value={t.plans_created} />
            <Stat label="Memberships created" value={t.memberships_created} />
          </div>

          {errorRows.length > 0 && (
            <div className="mt-6 rounded-md border border-red-500/40 bg-black p-4">
              <p className="text-sm text-red-300 font-medium mb-2">
                {errorRows.length} row{errorRows.length === 1 ? "" : "s"} failed
              </p>
              <ul className="space-y-1 text-xs text-[#ccc] max-h-48 overflow-auto">
                {errorRows.map((r) => (
                  <li key={r.index}>
                    Row {r.index + 1} ({r.full_name ?? "?"}):{" "}
                    {r.issues
                      .filter((x) => x.level === "error")
                      .map((x) => x.message)
                      .join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 mt-6 flex-wrap">
            <a
              href="/students"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-white text-black hover:bg-white/90 text-sm font-medium transition-colors"
            >
              View Students
              <ArrowRight className="h-4 w-4" />
            </a>
            <Button
              variant="outline"
              onClick={onReset}
              className="border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import another file
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────── Bits ───────────────────

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "bg-black border-[#1f1f1f] shadow-none",
        highlight && "border-red-500/40",
      )}
    >
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-widest text-[#888]">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums mt-1",
            highlight ? "text-red-300" : "text-white",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ActionBadge({ action }: { action: "create" | "update" | "skip" }) {
  const cls = {
    create: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    update: "border-blue-500/40 bg-blue-500/10 text-blue-300",
    skip: "border-[#333] bg-[#111] text-[#888]",
  }[action];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
        cls,
      )}
    >
      {action}
    </span>
  );
}

function MatchReasonBadge({ reason }: { reason: MatchReason }) {
  if (!reason) return <span className="text-[#555]">—</span>;
  const styles: Record<NonNullable<MatchReason>, string> = {
    email: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    phone: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    name:  "border-amber-500/30 bg-amber-500/10 text-amber-300",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider", styles[reason])}>
      {reason}
    </span>
  );
}

function FileChip({ file }: { file: File | null }) {
  if (!file) return null;
  const sizeKb = (file.size / 1024).toFixed(1);
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-[#222] bg-black px-3 py-2 text-sm text-[#ccc]">
      <FileSpreadsheet className="h-4 w-4 text-white" />
      <span className="font-medium text-white">{file.name}</span>
      <span className="text-[#666]">·</span>
      <span className="text-[#888]">{sizeKb} KB</span>
    </div>
  );
}

