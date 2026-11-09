"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Loader2, Save, Smartphone } from "lucide-react";

type PlatformKey = "android" | "ios";
type PlatformForm = { latestBuild: string; minBuild: string; storeUrl: string };
type AppVersions = {
  android: { latestBuild: number; minBuild: number; storeUrl: string };
  ios: { latestBuild: number; minBuild: number; storeUrl: string };
  message?: string;
};

const PLATFORMS: { key: PlatformKey; label: string; buildName: string }[] = [
  { key: "android", label: "Android", buildName: "version code" },
  { key: "ios", label: "iPhone", buildName: "build number" },
];

const toForm = (p: AppVersions["android"]): PlatformForm => ({
  latestBuild: p.latestBuild ? String(p.latestBuild) : "",
  minBuild: p.minBuild ? String(p.minBuild) : "",
  storeUrl: p.storeUrl || "",
});

/** Update prompts in the customer/rider app: who is told a new version is out, and who must update. */
export function AppUpdatesCard() {
  const [form, setForm] = useState<Record<PlatformKey, PlatformForm>>({
    android: { latestBuild: "", minBuild: "", storeUrl: "" },
    ios: { latestBuild: "", minBuild: "", storeUrl: "" },
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apply = (cfg?: AppVersions) => {
    if (!cfg) return;
    setForm({ android: toForm(cfg.android), ios: toForm(cfg.ios) });
    setMessage(cfg.message || "");
  };

  useEffect(() => {
    fetcher("/admin/settings")
      .then((data) => apply(data.appVersions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const set = (key: PlatformKey, patch: Partial<PlatformForm>) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      const num = (v: string) => (v.trim() ? Number(v) : 0);
      const saved = await fetcher("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          appVersions: {
            android: { latestBuild: num(form.android.latestBuild), minBuild: num(form.android.minBuild), storeUrl: form.android.storeUrl.trim() },
            ios: { latestBuild: num(form.ios.latestBuild), minBuild: num(form.ios.minBuild), storeUrl: form.ios.storeUrl.trim() },
            message: message.trim(),
          },
        }),
      });
      apply(saved?.appVersions);
      alert("App update settings saved.");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-orange-500" />
          App updates
        </CardTitle>
        <CardDescription>
          When customers and riders open the app, phones on an older build are asked to update. Use
          the store build number (Android version code, iPhone build number), not the version name:
          two builds can both say 1.0.5.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : (
          <>
            {PLATFORMS.map((p) => (
              <div key={p.key} className="space-y-3">
                <p className="text-sm font-medium text-gray-900">{p.label}</p>
                <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`${p.key}-latest`}>Latest {p.buildName}</Label>
                    <Input
                      id={`${p.key}-latest`}
                      type="number"
                      min={0}
                      placeholder="Not set"
                      value={form[p.key].latestBuild}
                      onChange={(e) => set(p.key, { latestBuild: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Older phones see &quot;A new version is available&quot; (they can skip it). Set this
                      once the build is live in the store.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor={`${p.key}-min`}>Oldest {p.buildName} allowed</Label>
                    <Input
                      id={`${p.key}-min`}
                      type="number"
                      min={0}
                      placeholder="Not set"
                      value={form[p.key].minBuild}
                      onChange={(e) => set(p.key, { minBuild: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Older phones must update before using the app. Only for changes old versions
                      can&apos;t handle.
                    </p>
                  </div>
                </div>
                <div className="max-w-xl">
                  <Label htmlFor={`${p.key}-url`}>Store link</Label>
                  <Input
                    id={`${p.key}-url`}
                    value={form[p.key].storeUrl}
                    onChange={(e) => set(p.key, { storeUrl: e.target.value })}
                  />
                </div>
              </div>
            ))}
            <div className="max-w-xl">
              <Label htmlFor="update-message">What&apos;s new (optional)</Label>
              <Input
                id="update-message"
                maxLength={200}
                placeholder="e.g. Faster gas refills and a new orders page"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">Shown in the update message.</p>
            </div>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : <><Save className="mr-2 h-4 w-4" /> Save app update settings</>}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
