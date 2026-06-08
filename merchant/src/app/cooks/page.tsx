"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetcher } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getCommerceOrderCopy } from "@/lib/commerceOrderCopy";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { ChefHat, Plus, Loader2, KeyRound, Trash2 } from "lucide-react";

interface Cook {
  _id: string;
  name: string;
  username: string;
  phone?: string;
  isSuspended: boolean;
  createdAt: string;
}

const EMPTY = { name: "", username: "", phone: "", password: "" };

export default function CooksPage() {
  const { isOwner, activeRestaurant } = useAuth();
  const copy = getCommerceOrderCopy(activeRestaurant?.vertical);
  const router = useRouter();
  const [cooks, setCooks] = useState<Cook[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [pwModal, setPwModal] = useState<Cook | null>(null);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!isOwner) router.replace("/");
  }, [isOwner, router]);

  const load = async () => {
    try {
      const data = await fetcher("/merchant/cooks");
      setCooks(data.cooks ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createCook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetcher("/merchant/cooks", { method: "POST", body: JSON.stringify(form) });
      setModalOpen(false);
      setForm({ ...EMPTY });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not add cook");
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspended = async (cook: Cook) => {
    setBusy(cook._id);
    try {
      await fetcher(`/merchant/cooks/${cook._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isSuspended: !cook.isSuspended }),
      });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwModal) return;
    setSaving(true);
    try {
      await fetcher(`/merchant/cooks/${pwModal._id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPassword }),
      });
      setPwModal(null);
      setNewPassword("");
      alert("Password updated");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cook: Cook) => {
    if (!confirm(`Remove ${cook.name}? They will no longer be able to sign in.`)) return;
    setBusy(cook._id);
    try {
      await fetcher(`/merchant/cooks/${cook._id}`, { method: "DELETE" });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-orange-500" />
          <h1 className="text-2xl font-bold text-gray-900">{copy.cooksNav}</h1>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-1 inline" /> Add cook
        </Button>
      </div>
      <p className="text-gray-600 mb-6">
        {copy.cooksDescription}
      </p>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : cooks.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          {copy.cooksEmpty}
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {cooks.map((cook) => (
            <div key={cook._id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{cook.name}</span>
                  {cook.isSuspended && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Disabled</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">@{cook.username}{cook.phone ? ` · ${cook.phone}` : ""}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setPwModal(cook)}>
                  <KeyRound className="h-4 w-4 mr-1 inline" /> Password
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === cook._id}
                  onClick={() => toggleSuspended(cook)}
                >
                  {cook.isSuspended ? "Enable" : "Disable"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600"
                  disabled={busy === cook._id}
                  onClick={() => remove(cook)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add cook">
        <form onSubmit={createCook} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="kofi_cook"
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone (for new-order SMS alerts)</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="0244123456"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add cook"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!pwModal} onClose={() => setPwModal(null)} title={`Reset password — ${pwModal?.name ?? ""}`}>
        <form onSubmit={resetPassword} className="space-y-4">
          <div>
            <Label htmlFor="newpw">New password</Label>
            <Input
              id="newpw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPwModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
