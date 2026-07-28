"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { unlockRestaurantAudio } from "@/lib/sound";
import { AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="merchant-atmosphere flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-yellow shadow-md ring-1 ring-black/5">
            <span className="text-2xl font-bold tracking-tight text-foreground">Q</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">QareGO</h1>
          <p className="mt-1 text-sm font-medium text-brand">Merchant</p>
          <p className="mt-3 text-sm text-muted">Orders, menu & kitchen — all in one place</p>
        </div>

        <Card className="border border-border shadow-lg ring-1 ring-slate-900/5">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Sign in with the login your administrator gave you
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder="mamas_kitchen"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">Sponsored by Qaretech</p>
      </div>
    </div>
  );
}
