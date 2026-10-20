"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { fetcher } from "@/lib/api";

const MIN_LENGTH = 8;

/** Current password + new password (typed twice). Used on first sign-in and in Settings. */
export function ChangePasswordForm({
  currentLabel = "Current password",
  submitLabel = "Change password",
  onDone,
}: {
  currentLabel?: string;
  submitLabel?: string;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = !!current && next.length >= MIN_LENGTH && confirm === next && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await fetcher("/merchant/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password");
    } finally {
      setBusy(false);
    }
  };

  const type = show ? "text" : "password";
  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <div>
        <Label htmlFor="currentPassword">{currentLabel}</Label>
        <Input
          id="currentPassword"
          type={type}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type={type}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
        />
        <p className={`mt-1 text-xs ${tooShort ? "text-red-600" : "text-muted"}`}>At least {MIN_LENGTH} characters.</p>
      </div>
      <div>
        <Label htmlFor="confirmPassword">Type the new password again</Label>
        <Input
          id="confirmPassword"
          type={type}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        {mismatch ? <p className="mt-1 text-xs text-red-600">The two passwords don&apos;t match.</p> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {show ? "Hide passwords" : "Show passwords"}
        </button>
        <Button type="submit" disabled={!canSubmit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </div>
    </form>
  );
}
