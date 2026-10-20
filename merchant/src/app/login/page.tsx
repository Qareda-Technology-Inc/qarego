"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { fetcher } from "@/lib/api";
import { unlockRestaurantAudio } from "@/lib/sound";
import {
  AlertCircle,
  BellRing,
  Bike,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: BellRing, title: "Never miss an order", body: "New orders ring until someone accepts them." },
  { icon: Bike, title: "Riders on the way", body: "QareGO riders collect and deliver for you." },
  { icon: Wallet, title: "Clear earnings", body: "Sales, fees and your balance with QareGO." },
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
    // A click unlocks browser audio so new-order alerts can play.
    unlockRestaurantAudio();
    setError("");
    setLoading(true);
    try {
      const data = await fetcher("/auth/merchant/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      login(data.accessToken, data.refreshToken, data.user, data.restaurants || []);
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
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-yellow/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <Image src="/qarego-mark.png" alt="" width={44} height={44} className="rounded-xl bg-white p-1" />
          <span className="text-xl font-bold tracking-tight">
            QareGO <span className="font-medium text-brand-yellow">for stores</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Your store, open to all of QareGO.
          </h1>
          <p className="mt-4 text-base text-white/70">
            Restaurants, groceries, pharmacies and gas stations run their orders here.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-5 w-5 text-brand-yellow" />
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
            <span className="text-lg font-bold text-foreground">
              QareGO <span className="font-medium text-brand">for stores</span>
            </span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-foreground">Sign in</h2>
          <p className="mt-2 text-sm text-muted">Use the login QareGO texted you (staff: the one your manager gave you). Your username or phone number both work.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <Field id="username" label="Username or phone number" icon={User}>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                placeholder="your.store or 024 123 4567"
                className="h-12 w-full rounded-xl border border-border bg-slate-50/70 pl-11 pr-4 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
            </Field>

            <Field id="password" label="Password" icon={Lock}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="h-12 w-full rounded-xl border border-border bg-slate-50/70 pl-11 pr-12 text-sm text-foreground outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:brightness-95 disabled:opacity-60"
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

          <p className="mt-10 text-center text-xs text-slate-400">
            Don&apos;t have a login? Ask QareGO to set up your store.
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
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {children}
      </div>
    </div>
  );
}
