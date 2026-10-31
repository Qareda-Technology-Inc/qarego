"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Flag, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { fetcher } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { Card, CardContent } from "@/components/ui/Card";

type Person = { _id: string; name?: string; phone?: string; role?: string } | null;
type ChatReport = {
  _id: string;
  ride: string;
  reporter: Person;
  reportedUser: Person;
  reason: "ABUSIVE" | "HARASSMENT" | "SPAM" | "SAFETY" | "OTHER";
  details?: string;
  messages: { sender?: string; text?: string | null; image?: string | null; sentAt?: string }[];
  status: "open" | "resolved";
  note?: string | null;
  createdAt: string;
};
type Filter = "open" | "resolved" | "all";

const REASON_LABEL: Record<ChatReport["reason"], string> = {
  ABUSIVE: "Abusive or offensive",
  HARASSMENT: "Harassment",
  SAFETY: "Felt unsafe",
  SPAM: "Spam or scam",
  OTHER: "Something else",
};

const who = (p: Person) =>
  p ? `${p.name || p.phone || "Unknown"}${p.role ? ` (${p.role})` : ""}` : "Deleted account";

function ReportCard({ report, onChanged }: { report: ChatReport; onChanged: () => void }) {
  const [note, setNote] = useState(report.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (status?: ChatReport["status"]) => {
    setBusy(true);
    setError(null);
    try {
      await fetcher(`/admin/chat-reports/${report._id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...(status ? { status } : {}), note }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  const reporterId = report.reporter?._id;

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">
              {who(report.reporter)} reported {who(report.reportedUser)}
            </p>
            <p className="text-sm text-gray-500">
              {REASON_LABEL[report.reason]} · {new Date(report.createdAt).toLocaleString()} ·{" "}
              <Link href={`/trips/${report.ride}`} className="text-blue-600 hover:underline">
                Trip #{report.ride.slice(-8).toUpperCase()}
              </Link>
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              report.status === "open" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
            }`}
          >
            {report.status === "open" ? "Open" : "Resolved"}
          </span>
        </div>

        {report.details ? (
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">&ldquo;{report.details}&rdquo;</p>
        ) : null}

        <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-gray-100 p-3">
          {report.messages.length === 0 ? (
            <p className="text-sm text-gray-400">No messages were sent in this chat.</p>
          ) : (
            report.messages.map((m, i) => {
              const fromReporter = m.sender === reporterId;
              return (
                <div key={i} className={`flex ${fromReporter ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      fromReporter ? "bg-blue-50 text-gray-800" : "bg-red-50 text-gray-900"
                    }`}
                  >
                    <p className="text-[11px] text-gray-500">
                      {fromReporter ? "Reporter" : "Reported"}
                      {m.sentAt ? ` · ${new Date(m.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                    {m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveMediaUrl(m.image) ?? m.image} alt="" className="mt-1 max-h-40 rounded-lg" />
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for the team: what you did (called them, warned, suspended…)"
            rows={2}
            maxLength={1000}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {report.status === "open" ? (
              <button
                onClick={() => save("resolved")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark resolved
              </button>
            ) : (
              <button
                onClick={() => save("open")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reopen
              </button>
            )}
            {note !== (report.note ?? "") ? (
              <button
                onClick={() => save()}
                disabled={busy}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Save note
              </button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChatReportsPage() {
  const [filter, setFilter] = useState<Filter>("open");
  const [reports, setReports] = useState<ChatReport[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetcher(`/admin/chat-reports?status=${filter}`);
      setReports(data.reports ?? []);
      setCounts(data.counts ?? {});
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load reports");
    }
  }, [filter]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const tabs: { key: Filter; label: string }[] = [
    { key: "open", label: `Open${counts.open ? ` (${counts.open})` : ""}` },
    { key: "resolved", label: "Resolved" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Chat reports</h1>
          <p className="text-sm text-gray-500">
            Customers and riders can report the other person from the in-trip chat. Check each one and note what you did.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setReports(null);
              setFilter(t.key);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === t.key ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {reports === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
          <Flag className="h-8 w-8" />
          <p className="text-sm">{filter === "open" ? "No open reports." : "No reports here."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <ReportCard key={r._id} report={r} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
