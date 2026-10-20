"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Download, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";

type Totals = {
  trips: number;
  parcels: number;
  orders: number;
  cancelledOrders: number;
  cancelRate: number;
  bookings: number;
  income: number;
  riderEarnings: number;
  newCustomers: number;
  newRiders: number;
  activeCustomers: number;
};
type Day = { date: string; trips: number; orders: number; bookings: number; income: number };
type Report = {
  from: string;
  to: string;
  days: number;
  previousFrom: string;
  previousTo: string;
  totals: Totals;
  previous: Totals;
  daily: Day[];
  byService: { key: string; label: string; count: number; cancelled: number | null; bookings: number; income: number }[];
  topStores: { _id: string; name: string; vertical: string; orders: number; cancelled: number; sales: number }[];
  topRiders: { _id: string; name?: string; phone?: string; jobs: number; earned: number }[];
  hours: { hour: number; count: number }[];
};

type Preset = "today" | "7d" | "30d" | "month" | "lastMonth" | "custom";
type Metric = "bookings" | "income" | "jobs";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "custom", label: "Custom" },
];

const VERTICAL_LABELS: Record<string, string> = {
  FOOD: "Food",
  GROCERY: "Groceries",
  PHARMACY: "Pharmacy",
  GAS: "Cooking gas",
  LAUNDRY: "Laundry",
};

// Ghana is on UTC all year, so UTC dates are local dates.
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

function presetRange(p: Exclude<Preset, "custom">): { from: string; to: string } {
  const today = new Date(`${iso(new Date())}T00:00:00Z`);
  switch (p) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "7d":
      return { from: iso(addDays(today, -6)), to: iso(today) };
    case "30d":
      return { from: iso(addDays(today, -29)), to: iso(today) };
    case "month":
      return { from: `${iso(today).slice(0, 8)}01`, to: iso(today) };
    case "lastMonth": {
      const firstThis = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const lastPrev = addDays(firstThis, -1);
      return { from: `${iso(lastPrev).slice(0, 8)}01`, to: iso(lastPrev) };
    }
  }
}

/** "2026-10-04" → "4 Oct" (or "4 Oct 2025" when the year matters). */
function shortDate(key: string, withYear = false) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

function hourLabel(h: number) {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function downloadCsv(report: Report) {
  const rows = [
    ["Date", "Trips & parcels", "Store orders", "Bookings (GHS)", "QareGO income (GHS)"],
    ...report.daily.map((d) => [d.date, d.trips, d.orders, d.bookings.toFixed(2), d.income.toFixed(2)]),
    [],
    ["Service", "Completed", "Cancelled", "Bookings (GHS)", "QareGO income (GHS)"],
    ...report.byService.map((s) => [s.label, s.count, s.cancelled ?? "", s.bookings.toFixed(2), s.income.toFixed(2)]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `qarego-report-${report.from}-to-${report.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState(() => presetRange("30d"));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("bookings");

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetcher(`/admin/reports?from=${range.from}&to=${range.to}`)
        .then((d: Report) => alive && setReport(d))
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Couldn't load the report"))
        .finally(() => alive && setLoading(false));
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [range]);

  const pickPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Reports"
        description="Completed trips and delivered orders for any period, compared with the period before it."
        actions={
          report ? (
            <Button variant="outline" onClick={() => downloadCsv(report)}>
              <Download className="mr-2 h-4 w-4" /> Download CSV
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => pickPreset(p.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                preset === p.key ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
              className="h-9 rounded-md border border-gray-300 px-2 text-gray-900"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={iso(new Date())}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
              className="h-9 rounded-md border border-gray-300 px-2 text-gray-900"
            />
          </div>
        ) : null}
        {report ? (
          <p className="w-full text-xs text-gray-500 xl:ml-auto xl:w-auto">
            {report.from === report.to
              ? shortDate(report.from, true)
              : `${shortDate(report.from, true)} – ${shortDate(report.to, true)}`}{" "}
            · compared with{" "}
            {report.previousFrom === report.previousTo
              ? shortDate(report.previousFrom, true)
              : `${shortDate(report.previousFrom)} – ${shortDate(report.previousTo, true)}`}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : !report ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          <Headline report={report} />

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center gap-2">
              <CardTitle className="mr-auto text-base">{report.days > 62 ? "Week by week" : "Day by day"}</CardTitle>
              {(
                [
                  ["bookings", "Bookings"],
                  ["income", "Income"],
                  ["jobs", "Jobs"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  className={`rounded-lg px-3 py-1 text-sm font-medium ${
                    metric === key ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </CardHeader>
            <CardContent>
              <DailyChart daily={report.daily} metric={metric} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">By service</CardTitle>
              </CardHeader>
              <CardContent>
                <ServiceTable rows={report.byService} />
              </CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Busiest hours</CardTitle>
                <p className="mt-1 text-sm text-gray-500">When completed trips and orders were booked.</p>
              </CardHeader>
              <CardContent>
                <HoursChart hours={report.hours} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top stores</CardTitle>
                <p className="mt-1 text-sm text-gray-500">By sales (item prices, before delivery and service fees).</p>
              </CardHeader>
              <CardContent>
                {report.topStores.length === 0 ? (
                  <Empty text="No store orders in this period." />
                ) : (
                  <ol className="divide-y divide-gray-100">
                    {report.topStores.map((s, i) => (
                      <li key={s._id}>
                        <Link href={`/restaurants/${s._id}`} className="flex items-center gap-3 py-2.5 hover:bg-gray-50">
                          <Rank n={i + 1} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">{s.name}</span>
                            <span className="block text-xs text-gray-500">
                              {VERTICAL_LABELS[s.vertical] ?? s.vertical} · {s.orders} delivered
                              {s.cancelled ? <span className="text-red-600"> · {s.cancelled} cancelled</span> : null}
                            </span>
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(s.sales)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top riders</CardTitle>
                <p className="mt-1 text-sm text-gray-500">By completed jobs, with what they earned after commission.</p>
              </CardHeader>
              <CardContent>
                {report.topRiders.length === 0 ? (
                  <Empty text="No completed jobs in this period." />
                ) : (
                  <ol className="divide-y divide-gray-100">
                    {report.topRiders.map((r, i) => (
                      <li key={r._id}>
                        <Link href={`/drivers/${r._id}`} className="flex items-center gap-3 py-2.5 hover:bg-gray-50">
                          <Rank n={i + 1} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">{r.name || "Rider"}</span>
                            <span className="block text-xs text-gray-500">
                              {r.jobs} {r.jobs === 1 ? "job" : "jobs"}
                              {r.phone ? ` · ${r.phone}` : ""}
                            </span>
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(r.earned)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Headline({ report }: { report: Report }) {
  const t = report.totals;
  const p = report.previous;
  const jobs = (x: Totals) => x.trips + x.parcels + x.orders;
  const cards: {
    label: string;
    value: string;
    now: number;
    before: number;
    note: string;
    lowerIsBetter?: boolean;
    accent: string;
  }[] = [
    {
      label: "Bookings",
      value: formatCurrency(t.bookings),
      now: t.bookings,
      before: p.bookings,
      note: "What customers paid",
      accent: "bg-green-500",
    },
    {
      label: "QareGO income",
      value: formatCurrency(t.income),
      now: t.income,
      before: p.income,
      note: "Commissions and service fees",
      accent: "bg-blue-500",
    },
    {
      label: "Completed jobs",
      value: String(jobs(t)),
      now: jobs(t),
      before: jobs(p),
      note: `${t.trips} rides · ${t.parcels} parcels · ${t.orders} orders`,
      accent: "bg-indigo-500",
    },
    {
      label: "Rider earnings",
      value: formatCurrency(t.riderEarnings),
      now: t.riderEarnings,
      before: p.riderEarnings,
      note: "After commission",
      accent: "bg-purple-500",
    },
    {
      label: "Customers served",
      value: String(t.activeCustomers),
      now: t.activeCustomers,
      before: p.activeCustomers,
      note: `${t.newCustomers} new sign-ups · ${t.newRiders} new riders`,
      accent: "bg-amber-500",
    },
    {
      label: "Orders cancelled",
      value: `${Math.round(t.cancelRate * 100)}%`,
      now: t.cancelRate,
      before: p.cancelRate,
      note: `${t.cancelledOrders} of ${t.orders + t.cancelledOrders} store orders`,
      lowerIsBetter: true,
      accent: "bg-red-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label} className="relative overflow-hidden">
          <span className={`absolute inset-y-0 left-0 w-1 ${c.accent}`} />
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-500">{c.label}</p>
              <Change now={c.now} before={c.before} lowerIsBetter={c.lowerIsBetter} />
            </div>
            <p className="mt-1 text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="mt-1 truncate text-xs text-gray-500">{c.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Up/down against the previous period; green when it moved the good way. */
function Change({ now, before, lowerIsBetter }: { now: number; before: number; lowerIsBetter?: boolean }) {
  if (!before) {
    return now ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">New</span> : null;
  }
  const pct = ((now - before) / Math.abs(before)) * 100;
  if (Math.abs(pct) < 0.5) {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">No change</span>;
  }
  const up = pct > 0;
  const good = lowerIsBetter ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        good ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct) >= 1000 ? "999+" : Math.round(Math.abs(pct))}%
    </span>
  );
}

function DailyChart({ daily, metric }: { daily: Day[]; metric: Metric }) {
  // Long ranges are shown by week so the bars stay readable.
  const buckets = useMemo(() => {
    if (daily.length <= 62) return daily.map((d) => ({ ...d, label: shortDate(d.date), end: d.date }));
    const weeks: (Day & { label: string; end: string })[] = [];
    for (let i = 0; i < daily.length; i += 7) {
      const chunk = daily.slice(i, i + 7);
      weeks.push({
        date: chunk[0].date,
        end: chunk[chunk.length - 1].date,
        label: `Week of ${shortDate(chunk[0].date)}`,
        trips: chunk.reduce((s, d) => s + d.trips, 0),
        orders: chunk.reduce((s, d) => s + d.orders, 0),
        bookings: chunk.reduce((s, d) => s + d.bookings, 0),
        income: chunk.reduce((s, d) => s + d.income, 0),
      });
    }
    return weeks;
  }, [daily]);

  const value = (d: Day) => (metric === "jobs" ? d.trips + d.orders : metric === "income" ? d.income : d.bookings);
  const max = Math.max(...buckets.map(value), 0);
  const fmt = (n: number) => (metric === "jobs" ? String(n) : formatCurrency(n));

  if (max === 0) return <Empty text="Nothing completed in this period." />;

  const labelEvery = Math.ceil(buckets.length / 8);
  return (
    <div>
      <div className="flex h-56 items-end gap-[2px] sm:gap-1">
        {buckets.map((d) => {
          const v = value(d);
          const tripShare = metric === "jobs" && v ? d.trips / v : 0;
          return (
            <div key={d.date} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
              <div
                className="flex w-full flex-col overflow-hidden rounded-t bg-blue-500 transition-colors group-hover:bg-blue-600"
                style={{ height: `${(v / max) * 100}%`, minHeight: v ? 2 : 0 }}
              >
                {metric === "jobs" ? <div className="w-full bg-indigo-300" style={{ height: `${tripShare * 100}%` }} /> : null}
              </div>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow group-hover:block">
                <p className="font-medium">{d.label}</p>
                <p>{fmt(v)}</p>
                {metric === "jobs" ? (
                  <p className="text-gray-300">
                    {d.trips} trips · {d.orders} orders
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px] border-t border-gray-200 pt-1.5 text-[10px] text-gray-400 sm:gap-1">
        {buckets.map((d, i) => (
          <span key={d.date} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % labelEvery === 0 ? (daily.length > 62 ? shortDate(d.date) : d.label) : ""}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        {metric === "jobs" ? (
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-indigo-300" /> Trips &amp; parcels
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Store orders
            </span>
          </span>
        ) : (
          <span />
        )}
        <span>
          Best {daily.length > 62 ? "week" : "day"}: {fmt(max)}
        </span>
      </div>
    </div>
  );
}

function ServiceTable({ rows }: { rows: Report["byService"] }) {
  const total = rows.reduce((s, r) => s + r.bookings, 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-gray-500">
          <tr>
            <th className="py-2 pr-4 font-medium">Service</th>
            <th className="py-2 pr-4 text-right font-medium">Completed</th>
            <th className="py-2 pr-4 text-right font-medium">Cancelled</th>
            <th className="py-2 pr-4 text-right font-medium">Bookings</th>
            <th className="py-2 text-right font-medium">Income</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.key} className={r.count || r.cancelled ? "" : "text-gray-400"}>
              <td className="py-2.5 pr-4">
                <span className="font-medium text-gray-900">{r.label}</span>
                <span className="mt-1 block h-1 w-full max-w-[8rem] overflow-hidden rounded-full bg-gray-100">
                  <span
                    className="block h-full rounded-full bg-blue-500"
                    style={{ width: `${total ? (r.bookings / total) * 100 : 0}%` }}
                  />
                </span>
              </td>
              <td className="py-2.5 pr-4 text-right">{r.count}</td>
              <td className={`py-2.5 pr-4 text-right ${r.cancelled ? "text-red-600" : ""}`}>
                {r.cancelled === null ? "—" : r.cancelled}
              </td>
              <td className="py-2.5 pr-4 text-right">{formatCurrency(r.bookings)}</td>
              <td className="py-2.5 text-right font-semibold">{formatCurrency(r.income)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HoursChart({ hours }: { hours: Report["hours"] }) {
  const max = Math.max(...hours.map((h) => h.count), 0);
  if (max === 0) return <Empty text="Nothing completed in this period." />;
  const peak = hours.reduce((a, b) => (b.count > a.count ? b : a));
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {hours.map((h) => (
          <div key={h.hour} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className={`w-full rounded-t ${h.hour === peak.hour ? "bg-amber-500" : "bg-amber-200"} group-hover:bg-amber-600`}
              style={{ height: `${(h.count / max) * 100}%`, minHeight: h.count ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
              {hourLabel(h.hour)} · {h.count}
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-1.5 h-3 text-[10px] text-gray-400">
        {[0, 6, 12, 18].map((h) => (
          <span key={h} className="absolute" style={{ left: `${(h / 24) * 100}%` }}>
            {hourLabel(h)}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm text-gray-600">
        Busiest around <strong className="text-gray-900">{hourLabel(peak.hour)}</strong> ({peak.count} booked).
      </p>
    </div>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        n === 1 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
      }`}
    >
      {n}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-gray-500">{text}</p>;
}
