"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { BellRing, Loader2, Mail, Save } from "lucide-react";

type OrderAlerts = {
  storeReminderMinutes: number;
  teamAlertMinutes: number;
  rideNoRiderMinutes?: number;
  parcelNoRiderMinutes?: number;
  courierNoRiderMinutes?: number;
  phones: string[];
};

/**
 * Orders a store hasn't accepted (remind the store, then text QareGO's team) and jobs no rider has
 * taken (text the team).
 */
export function OrderAlertsCard() {
  const [reminder, setReminder] = useState("3");
  const [teamAfter, setTeamAfter] = useState("5");
  const [rideAfter, setRideAfter] = useState("3");
  const [parcelAfter, setParcelAfter] = useState("2");
  const [courierAfter, setCourierAfter] = useState("5");
  const [phones, setPhones] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetcher("/admin/settings")
      .then((data) => {
        setEmailConfigured(data.emailConfigured === true);
        const cfg: OrderAlerts | undefined = data.orderAlerts;
        if (!cfg) return;
        setReminder(String(cfg.storeReminderMinutes));
        setTeamAfter(String(cfg.teamAlertMinutes));
        if (cfg.rideNoRiderMinutes) setRideAfter(String(cfg.rideNoRiderMinutes));
        if (cfg.parcelNoRiderMinutes) setParcelAfter(String(cfg.parcelNoRiderMinutes));
        if (cfg.courierNoRiderMinutes) setCourierAfter(String(cfg.courierNoRiderMinutes));
        setPhones((cfg.phones || []).join("\n"));
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const data = await fetcher("/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderAlerts: {
            storeReminderMinutes: Number(reminder),
            teamAlertMinutes: Number(teamAfter),
            rideNoRiderMinutes: Number(rideAfter),
            parcelNoRiderMinutes: Number(parcelAfter),
            courierNoRiderMinutes: Number(courierAfter),
            phones: phones.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean),
          },
        }),
      });
      if (data.orderAlerts) setPhones((data.orderAlerts.phones || []).join("\n"));
      alert("Order alerts saved.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save order alerts.");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const data = await fetcher("/admin/settings/test-email", { method: "POST" });
      alert(data.message || "Test email sent.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't send a test email.");
    } finally {
      setTesting(false);
    }
  };

  const noPhones = !phones.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-red-500" />
          Orders and trips nobody has taken
        </CardTitle>
        <CardDescription>
          If a store doesn&apos;t accept an order, the store gets a reminder, then your team gets an SMS
          with the store&apos;s and customer&apos;s numbers so someone can call. If no rider takes a
          ride, parcel or store delivery, your team gets an SMS with the pickup, the customer&apos;s
          number and how many riders are online, so someone can assign a rider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="alert-reminder">Remind the store after (minutes)</Label>
                <Input
                  id="alert-reminder"
                  type="number"
                  min="1"
                  max="60"
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="alert-team">Text the team after (minutes)</Label>
                <Input
                  id="alert-team"
                  type="number"
                  min="1"
                  max="60"
                  value={teamAfter}
                  onChange={(e) => setTeamAfter(e.target.value)}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">No rider yet: text the team after (minutes)</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="alert-ride">Ride</Label>
                  <Input id="alert-ride" type="number" min="1" max="60" value={rideAfter} onChange={(e) => setRideAfter(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="alert-parcel">Parcel</Label>
                  <Input id="alert-parcel" type="number" min="1" max="60" value={parcelAfter} onChange={(e) => setParcelAfter(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="alert-courier">Store delivery, once ready</Label>
                  <Input id="alert-courier" type="number" min="1" max="60" value={courierAfter} onChange={(e) => setCourierAfter(e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="alert-phones">Team phone numbers (one per line, up to 5)</Label>
              <textarea
                id="alert-phones"
                className="mt-1 flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={phones}
                onChange={(e) => setPhones(e.target.value)}
                placeholder={"0501234567\n0241234567"}
              />
              {noPhones ? (
                <p className="mt-1 text-xs text-amber-700">
                  No numbers yet. Add at least one so your team hears about stuck orders and trips by SMS.
                </p>
              ) : null}
              <p className="mt-1 text-xs text-gray-500">
                Super admins also get the alert by email. Add their email under Team (click &quot;Add
                email&quot; under their name).
              </p>
              {!emailConfigured ? (
                <p className="mt-1 text-xs text-amber-700">
                  Email isn&apos;t set up on the server yet, so only the SMS goes out. Add SMTP_HOST,
                  SMTP_PORT, SMTP_USER and SMTP_PASS on Render.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save order alerts
              </Button>
              <Button variant="outline" onClick={sendTest} disabled={testing}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send me a test email
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
