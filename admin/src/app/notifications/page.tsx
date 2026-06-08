"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { fetcher } from "@/lib/api";
import { Loader2, Bell, Eye, Megaphone, RotateCcw, Save, Send } from "lucide-react";

type BroadcastAudience = {
  id: string;
  label: string;
  users: number;
  devices: number;
};

type BroadcastRecord = {
  _id: string;
  title: string;
  body: string;
  audience: string;
  audienceLabel: string;
  usersTargeted: number;
  devicesTargeted: number;
  sentOk: number;
  sentFailed: number;
  status: string;
  sentByName: string;
  createdAt: string;
};

type PushTemplate = {
  key: string;
  label: string;
  audience: string;
  description: string;
  variables: string[];
  defaultTitle: string;
  defaultBody: string;
  title: string;
  body: string;
  enabled: boolean;
};

const SAMPLE_VARS: Record<string, Record<string, string>> = {
  ride_offer_trip: { fare: "GH₵ 24.50", pickup: "Accra Mall — Main entrance", rideId: "abc123" },
  ride_offer_delivery: { fare: "GH₵ 18.00", pickup: "KFC Osu — Restaurant", rideId: "def456" },
  ride_delivery_assigned: { fare: "GH₵ 18.00", pickup: "KFC Osu — Restaurant", rideId: "def456" },
  food_placed: { restaurantName: "Pizza Inn", orderId: "ord001" },
  food_preparing: { restaurantName: "Pizza Inn", orderId: "ord001" },
  food_ready_delivery: { restaurantName: "Pizza Inn", orderId: "ord001" },
  food_ready_pickup: { restaurantName: "Pizza Inn", orderId: "ord001" },
  food_driver_assigned: { restaurantName: "Pizza Inn", orderId: "ord001" },
  food_picked_up: { restaurantName: "Pizza Inn", orderId: "ord001" },
  food_delivered: { restaurantName: "Pizza Inn", orderId: "ord001" },
  food_cancelled: {
    restaurantName: "Pizza Inn",
    orderId: "ord001",
    cancelReason: "Restaurant is closed",
  },
  food_new_order_staff: {
    restaurantName: "Pizza Inn",
    orderId: "ord001",
    customerName: "Ama Mensah",
    orderTotal: "GH₵ 45.50",
    itemSummary: "2x Jollof, 1x Chicken",
  },
  test_push: {},
};

export default function PushNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [firebaseConfigured, setFirebaseConfigured] = useState(false);
  const [templates, setTemplates] = useState<PushTemplate[]>([]);
  const [draft, setDraft] = useState<Record<string, { title: string; body: string; enabled: boolean }>>(
    {}
  );
  const [preview, setPreview] = useState<Record<string, { title: string; body: string }>>({});
  const [audiences, setAudiences] = useState<BroadcastAudience[]>([]);
  const [recentBroadcasts, setRecentBroadcasts] = useState<BroadcastRecord[]>([]);
  const [broadcastAudience, setBroadcastAudience] = useState("app_users");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastDeepLink, setBroadcastDeepLink] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [templateData, broadcastData] = await Promise.all([
          fetcher("/admin/push-templates"),
          fetcher("/admin/push-broadcast"),
        ]);
        const list: PushTemplate[] = templateData.templates || [];
        setTemplates(list);
        setFirebaseConfigured(
          !!templateData.firebaseConfigured || !!broadcastData.firebaseConfigured
        );
        const initial: Record<string, { title: string; body: string; enabled: boolean }> = {};
        list.forEach((t) => {
          initial[t.key] = { title: t.title, body: t.body, enabled: t.enabled };
        });
        setDraft(initial);
        setAudiences(broadcastData.audiences || []);
        setRecentBroadcasts(broadcastData.recent || []);
      } catch (e) {
        console.error(e);
        alert("Failed to load push notifications.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedAudience = audiences.find((a) => a.id === broadcastAudience);

  const grouped = useMemo(() => {
    const rider = templates.filter((t) => t.audience === "rider");
    const customer = templates.filter((t) => t.audience === "customer");
    const other = templates.filter((t) => t.audience !== "rider" && t.audience !== "customer");
    return { rider, customer, other };
  }, [templates]);

  const updateDraft = (key: string, patch: Partial<{ title: string; body: string; enabled: boolean }>) => {
    setDraft((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const resetOne = (t: PushTemplate) => {
    updateDraft(t.key, {
      title: t.defaultTitle,
      body: t.defaultBody,
      enabled: true,
    });
  };

  const runPreview = async (key: string) => {
    const d = draft[key];
    if (!d) return;
    try {
      const res = await fetcher("/admin/push-templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          title: d.title,
          body: d.body,
          variables: SAMPLE_VARS[key] || {},
        }),
      });
      setPreview((p) => ({ ...p, [key]: { title: res.title, body: res.body } }));
    } catch (e) {
      console.error(e);
      alert("Preview failed.");
    }
  };

  const refreshBroadcasts = async () => {
    const data = await fetcher("/admin/push-broadcast");
    setAudiences(data.audiences || []);
    setRecentBroadcasts(data.recent || []);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      alert("Enter a title and message for the broadcast.");
      return;
    }
    const reach = selectedAudience?.devices ?? 0;
    const audienceLabel = selectedAudience?.label || broadcastAudience;
    const ok = window.confirm(
      `Send this push to ${reach} device${reach === 1 ? "" : "s"} (${audienceLabel})?\n\n` +
        `Title: ${broadcastTitle.trim()}\n` +
        `Message: ${broadcastBody.trim()}`
    );
    if (!ok) return;

    setSendingBroadcast(true);
    try {
      const res = await fetcher("/admin/push-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          audience: broadcastAudience,
          deepLink: broadcastDeepLink.trim() || undefined,
        }),
      });
      alert(
        `Broadcast sent to ${res.broadcast?.devicesTargeted ?? reach} devices ` +
          `(${res.broadcast?.sentOk ?? 0} delivered, ${res.broadcast?.sentFailed ?? 0} failed).`
      );
      setBroadcastTitle("");
      setBroadcastBody("");
      setBroadcastDeepLink("");
      await refreshBroadcasts();
    } catch (e) {
      console.error(e);
      alert("Failed to send broadcast.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, { title: string; body: string; enabled: boolean }> = {};
      Object.entries(draft).forEach(([key, v]) => {
        payload[key] = {
          title: v.title.trim(),
          body: v.body.trim(),
          enabled: v.enabled,
        };
      });
      await fetcher("/admin/push-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: payload }),
      });
      alert("Push notification templates saved.");
    } catch (e) {
      console.error(e);
      alert("Failed to save templates.");
    } finally {
      setSaving(false);
    }
  };

  const renderGroup = (title: string, items: PushTemplate[]) => {
    if (!items.length) return null;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {items.map((t) => {
          const d = draft[t.key];
          if (!d) return null;
          const pv = preview[t.key];
          return (
            <Card key={t.key} className={!d.enabled ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{t.label}</CardTitle>
                    <CardDescription className="mt-1">{t.description}</CardDescription>
                    <p className="text-xs text-gray-500 mt-2 font-mono">{t.key}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => updateDraft(t.key, { enabled: e.target.checked })}
                      className="rounded"
                    />
                    Enabled
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.variables.length > 0 ? (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1.5">
                    Variables:{" "}
                    {t.variables.map((v) => (
                      <code key={v} className="mx-0.5">{`{{${v}}}`}</code>
                    ))}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">No variables — static text only.</p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`${t.key}-title`}>Title</Label>
                    <Input
                      id={`${t.key}-title`}
                      value={d.title}
                      onChange={(e) => updateDraft(t.key, { title: e.target.value })}
                      maxLength={120}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`${t.key}-body`}>Body</Label>
                    <textarea
                      id={`${t.key}-body`}
                      className="flex min-h-[72px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                      value={d.body}
                      onChange={(e) => updateDraft(t.key, { body: e.target.value })}
                      maxLength={500}
                    />
                  </div>
                </div>

                {pv ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm">
                    <p className="font-semibold text-gray-700">Preview (sample data)</p>
                    <p className="mt-1 font-medium">{pv.title}</p>
                    <p className="text-gray-600">{pv.body}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => runPreview(t.key)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => resetOne(t)}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset to default
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-7 w-7 text-blue-600" />
            Push notifications
          </h1>
          <p className="text-gray-600 mt-1">
            Send broadcast messages to app users, or edit automated ride and order templates.
          </p>
          {!firebaseConfigured ? (
            <p className="text-amber-700 text-sm mt-2">
              Firebase is not configured on the server — pushes will not send until you add a service
              account.
            </p>
          ) : null}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save templates
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-indigo-600" />
            Broadcast message
          </CardTitle>
          <CardDescription>
            Send a one-off push to every registered device in the selected audience. Users must have
            opened the app and allowed notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="broadcast-audience">Audience</Label>
              <select
                id="broadcast-audience"
                value={broadcastAudience}
                onChange={(e) => setBroadcastAudience(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
              >
                {audiences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({a.devices} device{a.devices === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
              {selectedAudience ? (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedAudience.users} user{selectedAudience.users === 1 ? "" : "s"} ·{" "}
                  {selectedAudience.devices} device{selectedAudience.devices === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="broadcast-deeplink">Deep link (optional)</Label>
              <Input
                id="broadcast-deeplink"
                value={broadcastDeepLink}
                onChange={(e) => setBroadcastDeepLink(e.target.value)}
                placeholder="e.g. qarego://customer/search"
              />
              <p className="text-xs text-gray-500 mt-1">Opened when the user taps the notification.</p>
            </div>
          </div>

          <div>
            <Label htmlFor="broadcast-title">Title</Label>
            <Input
              id="broadcast-title"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="e.g. Free delivery this weekend!"
              maxLength={120}
            />
          </div>

          <div>
            <Label htmlFor="broadcast-body">Message</Label>
            <textarea
              id="broadcast-body"
              className="flex min-h-[96px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Write the announcement customers or riders will see…"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{broadcastBody.length}/500</p>
          </div>

          {(broadcastTitle.trim() || broadcastBody.trim()) && (
            <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50 p-3 text-sm">
              <p className="font-semibold text-indigo-900">Preview</p>
              <p className="mt-1 font-medium text-gray-900">{broadcastTitle.trim() || "QareGO"}</p>
              <p className="text-gray-700">{broadcastBody.trim() || "…"}</p>
            </div>
          )}

          <Button
            type="button"
            onClick={handleSendBroadcast}
            disabled={
              sendingBroadcast ||
              !firebaseConfigured ||
              !broadcastTitle.trim() ||
              !broadcastBody.trim() ||
              (selectedAudience?.devices ?? 0) === 0
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {sendingBroadcast ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send broadcast
          </Button>
        </CardContent>
      </Card>

      {recentBroadcasts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent broadcasts</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-3 font-medium">When</th>
                  <th className="pb-2 pr-3 font-medium">Audience</th>
                  <th className="pb-2 pr-3 font-medium">Title</th>
                  <th className="pb-2 pr-3 font-medium">Delivered</th>
                  <th className="pb-2 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {recentBroadcasts.map((row) => (
                  <tr key={row._id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">{row.audienceLabel}</td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{row.title}</span>
                      <span className="block text-xs text-gray-500 line-clamp-1">{row.body}</span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {row.sentOk}/{row.devicesTargeted}
                      {row.sentFailed > 0 ? (
                        <span className="text-amber-700 text-xs block">{row.sentFailed} failed</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-gray-600">{row.sentByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Automated templates</h2>
        <p className="text-sm text-gray-600 mb-4">
          Edit titles and messages for rides and food orders. Use{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">{`{{variableName}}`}</code> for dynamic
          text.
        </p>
      </div>

      {renderGroup("Rider", grouped.rider)}
      {renderGroup("Customer (food orders)", grouped.customer)}
      {renderGroup("Other", grouped.other)}
    </div>
  );
}
