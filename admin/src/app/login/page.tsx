"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { fetcher } from "@/lib/api";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MapPinned,
  Store,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: MapPinned, title: "Live operations", body: "Riders, trips and orders on one map, as they happen." },
  { icon: Store, title: "Every service", body: "Rides, parcels, food, groceries, pharmacy and gas." },
  { icon: Wallet, title: "Money in one place", body: "Commissions, store balances and cash collections." },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await fetcher("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      login(data.accessToken, data.refreshToken, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel (tablets and up) */}
      <aside className="relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b2a4a] via-[#134574] to-[#0f3a64] p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#edd228]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#ef7f22]/25 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <Image src="/qarego-mark.png" alt="" width={44} height={44} className="rounded-xl bg-white p-1" />
          <span className="text-xl font-bold tracking-tight">
            QareGO <span className="font-medium text-white/60">Admin</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Run QareGO from one place.</h1>
          <p className="mt-4 text-base text-white/70">
            The control room for rides, deliveries and stores across Ghana.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-5 w-5 text-[#edd228]" />
                </span>
                <span>
                  <span className="block font-semibold">{f.title}</span>
                  <span className="block text-sm text-white/65">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/45">© {new Date().getFullYear()} Qaretech · QareGO</p>
      </aside>

      {/* Sign-in form */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Image src="/qarego-mark.png" alt="" width={40} height={40} className="rounded-xl" />
            <span className="text-lg font-bold text-gray-900">
              QareGO <span className="font-medium text-gray-400">Admin</span>
            </span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Sign in</h2>
          <p className="mt-2 text-sm text-gray-500">Use your admin username and password.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <Field id="username" label="Username" icon={User}>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your.username"
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-11 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#134574] focus:bg-white focus:ring-4 focus:ring-[#134574]/10"
              />
            </Field>

            <Field id="password" label="Password" icon={Lock}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-11 pr-12 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#134574] focus:bg-white focus:ring-4 focus:ring-[#134574]/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#134574] text-sm font-semibold text-white shadow-lg shadow-[#134574]/20 transition hover:bg-[#0b2a4a] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-gray-400">
            Trouble signing in? Contact your QareGO super admin.
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        {children}
      </div>
    </div>
  );
}
