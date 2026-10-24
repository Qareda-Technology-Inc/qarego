"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Plus, ShieldCheck } from "lucide-react";
import { fetcher } from "@/lib/api";
import { ADMIN_ROLE_LABEL, type AdminRole } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";

type Member = {
  _id: string;
  name: string | null;
  username: string;
  phone: string | null;
  adminRole: AdminRole;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type SignIn = { name: string; username: string; tempPassword: string; sms: { sent: boolean; reason?: string }; reason: "invite" | "reset" };

const ROLE_HELP: Record<AdminRole, string> = {
  super: "Everything, including adding and managing the team.",
  admin: "Everything except managing the team: money, settings, trips, orders, riders and stores.",
  staff: "Onboarding only: add and approve riders, invite vendors, set up and approve their stores. No money, settings, trips, orders or customer data.",
};

const EMPTY = { name: "", username: "", phone: "", adminRole: "staff" as AdminRole };

/** Super admin: who can use the admin portal, and what each person can do. */
export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState<string | null>(null);
  const [signIn, setSignIn] = useState<SignIn | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetcher("/admin/team");
      setMembers(data.members ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("add");
    try {
      const data = await fetcher("/admin/team", {
        method: "POST",
        body: JSON.stringify({ ...form, phone: form.phone.trim() || null }),
      });
      setAdding(false);
      setForm({ ...EMPTY });
      setSignIn({ name: data.member.name, username: data.member.username, tempPassword: data.tempPassword, sms: data.sms, reason: "invite" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't add them");
    } finally {
      setBusy(null);
    }
  };

  const update = async (m: Member, patch: Partial<{ adminRole: AdminRole; active: boolean }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(m._id);
    try {
      await fetcher(`/admin/team/${m._id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = async (m: Member) => {
    if (!window.confirm(`Give ${m.name || m.username} a new temporary password? Their current password stops working.`)) return;
    setBusy(m._id);
    try {
      const data = await fetcher(`/admin/team/${m._id}/reset-password`, { method: "POST", body: "{}" });
      setSignIn({ name: m.name || m.username, username: m.username, tempPassword: data.tempPassword, sms: data.sms, reason: "reset" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't reset the password");
    } finally {
      setBusy(null);
    }
  };

  const signInMessage = signIn
    ? `${signIn.reason === "reset" ? "Your QareGO admin password was reset." : "You now have a QareGO admin account."}\n` +
      `Sign in: ${typeof window !== "undefined" ? window.location.origin : ""}\n` +
      `Username: ${signIn.username}\nTemporary password: ${signIn.tempPassword}\n` +
      "You'll choose your own password when you sign in."
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(signInMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the details are on screen */
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
            <ShieldCheck className="h-6 w-6 text-blue-600" /> Team
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Everyone who can sign in to this admin portal, and what they can do. Give each person their own account.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add a person
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(Object.keys(ROLE_HELP) as AdminRole[]).map((r) => (
          <Card key={r}>
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-gray-900">{ADMIN_ROLE_LABEL[r]}</p>
              <p className="mt-1 text-xs text-gray-600">{ROLE_HELP[r]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <CardDescription>Turn an account off to stop someone signing in straight away. Their past work stays on record.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Person</th>
                    <th className="py-2 pr-3 font-medium">Role</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Last sign-in</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isMe = m._id === user?.userId;
                    return (
                      <tr key={m._id} className="border-t align-top">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-gray-900">
                            {m.name || m.username} {isMe ? <span className="text-xs text-gray-500">(you)</span> : null}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{m.username}
                            {m.phone ? ` · ${m.phone}` : ""}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <select
                            value={m.adminRole}
                            disabled={isMe || busy === m._id}
                            onChange={(e) => update(m, { adminRole: e.target.value as AdminRole })}
                            className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
                            title={isMe ? "You can't change your own role" : undefined}
                          >
                            {(Object.keys(ADMIN_ROLE_LABEL) as AdminRole[]).map((r) => (
                              <option key={r} value={r}>
                                {ADMIN_ROLE_LABEL[r]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 pr-3">
                          {!m.active ? (
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">Turned off</span>
                          ) : m.mustChangePassword ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Hasn&apos;t signed in yet</span>
                          ) : (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Active</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-600">
                          {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          {isMe ? null : (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" disabled={busy === m._id} onClick={() => resetPassword(m)}>
                                <KeyRound className="mr-1 h-4 w-4" /> Reset password
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === m._id}
                                onClick={() =>
                                  update(
                                    m,
                                    { active: !m.active },
                                    m.active ? `Turn off ${m.name || m.username}'s account? They're signed out straight away.` : undefined
                                  )
                                }
                              >
                                {m.active ? "Turn off" : "Turn on"}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={adding} onClose={() => setAdding(false)} title="Add a person">
        <form onSubmit={add} className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
              placeholder="e.g. ama.mensah"
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional, to text them their sign-in details)</Label>
            <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="024 000 0000" />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={form.adminRole}
              onChange={(e) => setForm({ ...form, adminRole: e.target.value as AdminRole })}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
            >
              {(Object.keys(ADMIN_ROLE_LABEL) as AdminRole[]).map((r) => (
                <option key={r} value={r}>
                  {ADMIN_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">{ROLE_HELP[form.adminRole]}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy === "add"}>
              {busy === "add" ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!signIn} onClose={() => setSignIn(null)} title="Sign-in details">
        {signIn ? (
          <div className="space-y-3 text-sm">
            <p className="text-gray-700">
              {signIn.sms.sent
                ? `We texted these details to ${signIn.name}.`
                : `Send these details to ${signIn.name} yourself${signIn.sms.reason ? ` (${signIn.sms.reason.toLowerCase()})` : ""}.`}{" "}
              This is the only time the temporary password is shown. They choose their own when they sign in.
            </p>
            <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-800">{signInMessage}</pre>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={copy}>
                <Copy className="mr-1 h-4 w-4" /> {copied ? "Copied" : "Copy"}
              </Button>
              <Button onClick={() => setSignIn(null)}>Done</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
