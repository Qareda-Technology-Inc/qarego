"use client";

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { CURRENCY_SYMBOL } from '@/lib/currency';
import { fetcher, getApiBaseUrl } from '@/lib/api';
import { notify } from '@/lib/notify';
import { Save, Loader2, Volume2, Receipt, Percent, Radar, PauseCircle, Store, Bell, RotateCcw } from 'lucide-react';
import { SettingsCheckboxOption } from '@/components/SettingsCheckboxOption';
import { SettingsAudioUpload } from '@/components/SettingsAudioUpload';
import { MenuCategoryLayoutsCard } from '@/components/MenuCategoryLayoutsCard';
import { FoodPromoBannersCard } from '@/components/FoodPromoBannersCard';
import { GasPricesCard } from '@/components/GasPricesCard';
import { useFeatures } from "@/lib/features";

/** Parse a number field; allow 0. Returns null when empty/invalid. */
function parseOptionalNumber(raw: string): number | null {
  const n = Number(String(raw ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

/** Rates are typed as percentages ("15") and saved as fractions (0.15). */
function parsePercent(raw: string, fallback: number): number {
  const n = parseOptionalNumber(raw);
  if (n == null) return fallback;
  return Math.min(1, Math.max(0, n / 100));
}

/** 0.15 → "15" (rounded so 0.07 doesn't show as 7.000000000000001). */
function toPercentText(fraction: number): string {
  return String(Math.round(fraction * 100 * 100) / 100);
}

function parseMoney(raw: string, fallback: number): number {
  const n = parseOptionalNumber(raw);
  if (n == null) return fallback;
  return Math.max(0, n);
}

const VEHICLES = ['motorcycle', 'pragya', 'comfort'] as const;
const VEHICLE_LABELS: Record<(typeof VEHICLES)[number], string> = {
  motorcycle: 'Motorcycle',
  pragya: 'Pragya (tricycle)',
  comfort: 'Comfort (car)',
};
const DEFAULT_FARES: Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> = {
  motorcycle: { baseFare: 8, perKmRate: 4, minimumFare: 20 },
  pragya: { baseFare: 12, perKmRate: 6, minimumFare: 28 },
  comfort: { baseFare: 18, perKmRate: 9, minimumFare: 45 },
};

type FareForm = Record<string, { baseFare: string; perKmRate: string; minimumFare: string }>;

/** Everything on the page that is edited first and then saved with the tab's Save button. */
type Form = {
  fares: FareForm;
  storeFees: { rate: string; min: string; max: string; deliveryCommission: string };
  commission: {
    global: string;
    ride: string;
    delivery: string;
    food: string;
    debtLimit: string;
    minCashout: string;
  };
  vehiclePolicy: { pragyaFoodEnabled: boolean; comfortFoodEnabled: boolean };
  reliability: { strikesBeforePause: string; pauseDurationHours: string; strikeDecayOnCompletion: string };
  ranking: {
    fareWeight: string;
    earningsPerKmWeight: string;
    pickupPenaltyPerKm: string;
    urgencyWeight: string;
    foodReadyBoost: string;
    maxPickupKm: string;
  };
  pause: { RIDE: boolean; DELIVERY: boolean; FOOD: boolean };
};

const TABS = [
  { key: 'fares', label: 'Fares & fees', icon: Receipt, parts: ['fares', 'storeFees'] },
  { key: 'commission', label: 'Commission', icon: Percent, parts: ['commission'] },
  { key: 'dispatch', label: 'Dispatch', icon: Radar, parts: ['vehiclePolicy', 'reliability', 'ranking'] },
  { key: 'pause', label: 'Pause services', icon: PauseCircle, parts: ['pause'] },
  { key: 'stores', label: 'Store app', icon: Store, parts: [] },
  { key: 'sounds', label: 'Alert sounds', icon: Bell, parts: [] },
] as const satisfies readonly { key: string; label: string; icon: unknown; parts: readonly (keyof Form)[] }[];
type TabKey = (typeof TABS)[number]['key'];

const partsOf = (tab: TabKey): readonly (keyof Form)[] => TABS.find((t) => t.key === tab)?.parts ?? [];

/** Copy the given parts from `source` into `target`. */
function withParts(target: Form, source: Form, parts: readonly (keyof Form)[]): Form {
  const next = { ...target };
  for (const p of parts) Object.assign(next, { [p]: source[p] });
  return next;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formFromSettings(data: any): Form {
  const rate = data.commissionRate ?? 0.15;
  const vcp = data.vehicleCapabilityPolicy || {};
  const rp = data.reliabilityPolicy || {};
  const rw = data.dispatchRankingWeights || {};
  const sm = data.serviceMaintenance || {};
  const fares: FareForm = {};
  for (const v of VEHICLES) {
    const r = data.fareRates?.[v] || {};
    const d = DEFAULT_FARES[v];
    fares[v] = {
      baseFare: String(r.baseFare ?? d.baseFare),
      perKmRate: String(r.perKmRate ?? d.perKmRate),
      minimumFare: String(r.minimumFare ?? d.minimumFare),
    };
  }
  return {
    fares,
    storeFees: {
      rate: toPercentText(data.foodServiceFeeRate ?? 0.08),
      min: String(data.foodServiceFeeMin ?? 2),
      max: String(data.foodServiceFeeMax ?? 12),
      deliveryCommission: toPercentText(data.foodDeliveryCommissionRate ?? 0),
    },
    commission: {
      global: toPercentText(rate),
      ride: toPercentText(data.commissionByService?.RIDE ?? rate),
      delivery: toPercentText(data.commissionByService?.DELIVERY ?? rate),
      food: toPercentText(data.commissionByService?.FOOD ?? rate),
      debtLimit: String(data.debtLimit ?? -100),
      minCashout: String(data.minCashoutAmount ?? 1),
    },
    vehiclePolicy: { pragyaFoodEnabled: !!vcp.pragyaFoodEnabled, comfortFoodEnabled: !!vcp.comfortFoodEnabled },
    reliability: {
      strikesBeforePause: String(rp.strikesBeforePause ?? 5),
      pauseDurationHours: String(rp.pauseDurationHours ?? 24),
      strikeDecayOnCompletion: String(rp.strikeDecayOnCompletion ?? 1),
    },
    ranking: {
      fareWeight: String(rw.fareWeight ?? 1),
      earningsPerKmWeight: String(rw.earningsPerKmWeight ?? 8),
      pickupPenaltyPerKm: String(rw.pickupPenaltyPerKm ?? 4),
      urgencyWeight: String(rw.urgencyWeight ?? 10),
      foodReadyBoost: String(rw.foodReadyBoost ?? 12),
      maxPickupKm: String(rw.maxPickupKm ?? 25),
    },
    pause: { RIDE: !!sm.RIDE, DELIVERY: !!sm.DELIVERY, FOOD: !!sm.FOOD },
  };
}

/** What a tab's Save button sends, or an error message when a field is wrong. */
function payloadFor(tab: TabKey, f: Form): Record<string, unknown> | string {
  switch (tab) {
    case 'fares': {
      const fareRates: Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> = {};
      for (const v of VEHICLES) {
        fareRates[v] = {
          baseFare: parseMoney(f.fares[v].baseFare, 0),
          perKmRate: parseMoney(f.fares[v].perKmRate, 0),
          minimumFare: parseMoney(f.fares[v].minimumFare, 0),
        };
      }
      const foodServiceFeeMin = parseMoney(f.storeFees.min, 2);
      const foodServiceFeeMax = parseMoney(f.storeFees.max, 12);
      if (foodServiceFeeMin > foodServiceFeeMax) return 'The service fee minimum is higher than the maximum.';
      return {
        fareRates,
        foodServiceFeeRate: parsePercent(f.storeFees.rate, 0.08),
        foodServiceFeeMin,
        foodServiceFeeMax,
        foodDeliveryCommissionRate: parsePercent(f.storeFees.deliveryCommission, 0),
      };
    }
    case 'commission': {
      const debtLimit = parseOptionalNumber(f.commission.debtLimit);
      if (debtLimit == null || String(f.commission.debtLimit).trim() === '') {
        return 'Debt limit must be a number, for example -100.';
      }
      return {
        commissionRate: parsePercent(f.commission.global, 0.15),
        commissionByService: {
          RIDE: parsePercent(f.commission.ride, 0.15),
          DELIVERY: parsePercent(f.commission.delivery, 0.15),
          FOOD: parsePercent(f.commission.food, 0.15),
        },
        debtLimit,
        minCashoutAmount: parseMoney(f.commission.minCashout, 1),
      };
    }
    case 'dispatch':
      return {
        vehicleCapabilityPolicy: f.vehiclePolicy,
        reliabilityPolicy: {
          strikesBeforePause: parseInt(f.reliability.strikesBeforePause, 10) || 5,
          pauseDurationHours: parseInt(f.reliability.pauseDurationHours, 10) || 24,
          strikeDecayOnCompletion: parseInt(f.reliability.strikeDecayOnCompletion, 10) || 1,
        },
        dispatchRankingWeights: {
          fareWeight: parseFloat(f.ranking.fareWeight) || 1,
          earningsPerKmWeight: parseFloat(f.ranking.earningsPerKmWeight) || 8,
          pickupPenaltyPerKm: parseFloat(f.ranking.pickupPenaltyPerKm) || 4,
          urgencyWeight: parseFloat(f.ranking.urgencyWeight) || 10,
          foodReadyBoost: parseFloat(f.ranking.foodReadyBoost) || 12,
          maxPickupKm: parseFloat(f.ranking.maxPickupKm) || 25,
        },
      };
    case 'pause':
      return { serviceMaintenance: f.pause };
    default:
      return {};
  }
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsTabs />
    </Suspense>
  );
}

function SettingsTabs() {
  const { momoEnabled } = useFeatures();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requestedTab = params.get('tab');
  const tab: TabKey = TABS.some((t) => t.key === requestedTab) ? (requestedTab as TabKey) : 'fares';
  const openTab = (key: TabKey) => router.replace(`${pathname}?tab=${key}`, { scroll: false });

  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [kitchenSoundUrl, setKitchenSoundUrl] = useState('/sounds/new-order.mp3');
  const [riderSoundUrl, setRiderSoundUrl] = useState('/sounds/rider.mp3');
  const [uploadingSound, setUploadingSound] = useState(false);
  const [uploadingRiderSound, setUploadingRiderSound] = useState(false);

  useEffect(() => {
    let alive = true;
    fetcher('/admin/settings')
      .then((data) => {
        if (!alive) return;
        const next = formFromSettings(data);
        setForm(next);
        setSaved(next);
        setKitchenSoundUrl(data.kitchenAlertSoundUrl || '/sounds/new-order.mp3');
        setRiderSoundUrl(data.riderAlertSoundUrl || '/sounds/rider.mp3');
      })
      .catch((e: unknown) => alive && setLoadError(e instanceof Error ? e.message : 'Could not load settings'));
    return () => {
      alive = false;
    };
  }, []);

  const isDirty = (key: TabKey) =>
    !!form && !!saved && partsOf(key).some((p) => JSON.stringify(form[p]) !== JSON.stringify(saved[p]));
  const anyDirty = TABS.some((t) => isDirty(t.key));
  const pausedCount = saved ? Object.values(saved.pause).filter(Boolean).length : 0;

  // Warn before closing the page with edits that were never saved.
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  const update = <K extends keyof Form>(part: K, patch: Partial<Form[K]>) =>
    setForm((f) => (f ? { ...f, [part]: { ...f[part], ...patch } } : f));

  const discard = () => setForm((f) => (f && saved ? withParts(f, saved, partsOf(tab)) : f));

  const saveTab = async () => {
    if (!form) return;
    const payload = payloadFor(tab, form);
    if (typeof payload === 'string') {
      notify.error(payload);
      return;
    }
    setSaving(true);
    try {
      const data = await fetcher('/admin/settings', { method: 'PATCH', body: JSON.stringify(payload) });
      // Show what the server actually stored (it clamps and rounds some values).
      const stored = formFromSettings(data);
      const parts = partsOf(tab);
      setForm((f) => (f ? withParts(f, stored, parts) : f));
      setSaved((s) => (s ? withParts(s, stored, parts) : s));
      notify.success('Settings saved');
    } catch (e) {
      notify.error('Could not save settings', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const saveSoundUrl = async (field: 'kitchenAlertSoundUrl' | 'riderAlertSoundUrl', value: string, fallback: string) => {
    setSaving(true);
    try {
      await fetcher('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value.trim() || fallback }),
      });
      notify.success('Alert sound saved');
    } catch (e) {
      notify.error('Could not save the alert sound', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const uploadSound = async (
    file: File | null,
    endpoint: 'kitchen-alert-sound' | 'rider-alert-sound',
    onDone: (url: string) => void,
    setBusy: (busy: boolean) => void,
    successMessage: string
  ) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      notify.error('Choose an audio file (mp3, wav, etc.)');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('sound', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch(`${getApiBaseUrl()}/admin/settings/${endpoint}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      onDone(data.kitchenAlertSoundUrl || data.riderAlertSoundUrl);
      notify.success(successMessage);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const tabHasForm = partsOf(tab).length > 0;
  const dirty = isDirty(tab);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-0.5 text-sm text-gray-500">Prices, commission and how offers reach riders.</p>
        </div>
        <a href="/dispatch" className="text-sm text-blue-600 hover:underline">
          Rider dispatch overview →
        </a>
      </div>

      <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Settings sections">
        <div className="flex min-w-max gap-1 border-b border-gray-200">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => openTab(t.key)}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {t.key === 'pause' && pausedCount ? (
                  <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">
                    {pausedCount} paused
                  </span>
                ) : null}
                {isDirty(t.key) ? (
                  <span className="h-2 w-2 rounded-full bg-amber-500" title="Unsaved changes" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>
      ) : !form ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className={`space-y-6 ${tabHasForm ? 'pb-24' : ''}`}>
          {tab === 'fares' ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Ride and parcel fares</CardTitle>
                  <CardDescription>
                    Fare = base fare + price per km, never less than the minimum. Set for each vehicle.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="hidden grid-cols-[10rem_1fr_1fr_1fr] gap-3 pb-2 text-xs font-medium uppercase text-gray-500 sm:grid">
                    <span>Vehicle</span>
                    <span>Base fare ({CURRENCY_SYMBOL})</span>
                    <span>Per km ({CURRENCY_SYMBOL})</span>
                    <span>Minimum ({CURRENCY_SYMBOL})</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {VEHICLES.map((v) => (
                      <div key={v} className="grid grid-cols-3 gap-3 py-3 sm:grid-cols-[10rem_1fr_1fr_1fr] sm:items-center">
                        <span className="col-span-3 font-medium text-gray-900 sm:col-span-1">{VEHICLE_LABELS[v]}</span>
                        {(
                          [
                            ['baseFare', 'Base fare'],
                            ['perKmRate', 'Per km'],
                            ['minimumFare', 'Minimum'],
                          ] as const
                        ).map(([field, label]) => (
                          <label key={field} className="space-y-1">
                            <span className="block text-xs text-gray-500 sm:hidden">{label}</span>
                            <Input
                              aria-label={`${VEHICLE_LABELS[v]} ${label.toLowerCase()}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.fares[v][field]}
                              onChange={(e) => update('fares', { [v]: { ...form.fares[v], [field]: e.target.value } })}
                            />
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Store order fees</CardTitle>
                  <CardDescription>
                    Food, groceries, pharmacy and gas. The service fee is added at checkout; the commission on the
                    delivery fee is taken from the rider when the order is delivered.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      id="foodServiceFeeRate"
                      label="Service fee (%)"
                      hint="Of the items' total"
                      step="0.5"
                      max="100"
                      value={form.storeFees.rate}
                      onChange={(rate) => update('storeFees', { rate })}
                    />
                    <Field
                      id="foodServiceFeeMin"
                      label={`Service fee at least (${CURRENCY_SYMBOL})`}
                      step="0.01"
                      value={form.storeFees.min}
                      onChange={(min) => update('storeFees', { min })}
                    />
                    <Field
                      id="foodServiceFeeMax"
                      label={`Service fee at most (${CURRENCY_SYMBOL})`}
                      step="0.01"
                      value={form.storeFees.max}
                      onChange={(max) => update('storeFees', { max })}
                    />
                    <Field
                      id="foodDeliveryCommissionRate"
                      label="Commission on delivery fee (%)"
                      hint="0 = the rider keeps the whole delivery fee"
                      step="0.5"
                      max="100"
                      value={form.storeFees.deliveryCommission}
                      onChange={(deliveryCommission) => update('storeFees', { deliveryCommission })}
                    />
                  </div>
                </CardContent>
              </Card>

              <GasPricesCard />
            </>
          ) : null}

          {tab === 'commission' ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Commission by service</CardTitle>
                  <CardDescription>
                    QareGO&apos;s share of each completed job. For store orders it&apos;s taken from the items&apos;
                    total when the order is delivered.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field
                      id="commissionRide"
                      label="Rides (%)"
                      step="0.5"
                      max="100"
                      value={form.commission.ride}
                      onChange={(ride) => update('commission', { ride })}
                    />
                    <Field
                      id="commissionDelivery"
                      label="Parcels (%)"
                      step="0.5"
                      max="100"
                      value={form.commission.delivery}
                      onChange={(delivery) => update('commission', { delivery })}
                    />
                    <Field
                      id="commissionFood"
                      label="Store orders (%)"
                      step="0.5"
                      max="100"
                      value={form.commission.food}
                      onChange={(food) => update('commission', { food })}
                    />
                  </div>
                  <div className="mt-4 max-w-xs">
                    <Field
                      id="commissionRate"
                      label="Default (%)"
                      hint="Used for any service without a rate of its own"
                      step="0.5"
                      max="100"
                      value={form.commission.global}
                      onChange={(global) => update('commission', { global })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rider balances</CardTitle>
                  <CardDescription>
                    Riders collect cash and owe QareGO the commission. When a rider&apos;s balance falls below the
                    debt limit they are suspended until they pay.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      id="debtLimit"
                      label={`Debt limit (${CURRENCY_SYMBOL})`}
                      hint="A negative number, e.g. -100"
                      min=""
                      value={form.commission.debtLimit}
                      onChange={(debtLimit) => update('commission', { debtLimit })}
                    />
                    {/* Riders cash out by mobile money, which is paused. */}
                    {momoEnabled ? (
                      <Field
                        id="minCashoutAmount"
                        label={`Smallest cash-out (${CURRENCY_SYMBOL})`}
                        hint="Minimum a rider can withdraw at once"
                        step="0.01"
                        value={form.commission.minCashout}
                        onChange={(minCashout) => update('commission', { minCashout })}
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}

          {tab === 'dispatch' ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Which vehicles get store deliveries</CardTitle>
                  <CardDescription>
                    Motorcycles always get ride, parcel and store-delivery offers. Pragya and Comfort riders get store
                    deliveries only when turned on here, and only if food is in their work mode on their driver page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-gray-900">
                  <SettingsCheckboxOption
                    id="pragyaFoodEnabled"
                    checked={form.vehiclePolicy.pragyaFoodEnabled}
                    onChange={(pragyaFoodEnabled) => update('vehiclePolicy', { pragyaFoodEnabled })}
                    title="Pragya (tricycle) can deliver store orders"
                    activeHint="Pragya riders with food in their work mode will get store-delivery offers."
                  />
                  <SettingsCheckboxOption
                    id="comfortFoodEnabled"
                    checked={form.vehiclePolicy.comfortFoodEnabled}
                    onChange={(comfortFoodEnabled) => update('vehiclePolicy', { comfortFoodEnabled })}
                    title="Comfort (car) can deliver store orders"
                    activeHint="Car riders with food in their work mode will get store-delivery offers."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Missed offers</CardTitle>
                  <CardDescription>
                    Letting an offer time out or dismissing it adds a strike. Too many strikes pauses the rider for that
                    service; completing jobs removes strikes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field
                      id="strikesBeforePause"
                      label="Strikes before a pause"
                      min="1"
                      value={form.reliability.strikesBeforePause}
                      onChange={(strikesBeforePause) => update('reliability', { strikesBeforePause })}
                    />
                    <Field
                      id="pauseDurationHours"
                      label="Pause length (hours)"
                      min="1"
                      value={form.reliability.pauseDurationHours}
                      onChange={(pauseDurationHours) => update('reliability', { pauseDurationHours })}
                    />
                    <Field
                      id="strikeDecayOnCompletion"
                      label="Strikes removed per completed job"
                      value={form.reliability.strikeDecayOnCompletion}
                      onChange={(strikeDecayOnCompletion) => update('reliability', { strikeDecayOnCompletion })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Offer ranking</CardTitle>
                  <CardDescription>
                    How each job is scored for each rider; higher scores are offered first. Change these only if you
                    know what they do.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {(
                      [
                        ['fareWeight', 'Fare weight'],
                        ['earningsPerKmWeight', 'Pay per km weight'],
                        ['pickupPenaltyPerKm', 'Pickup distance penalty'],
                        ['urgencyWeight', 'Urgency boost'],
                        ['foodReadyBoost', 'Order ready boost'],
                        ['maxPickupKm', 'Furthest pickup (km)'],
                      ] as const
                    ).map(([key, label]) => (
                      <Field
                        key={key}
                        id={key}
                        label={label}
                        step="0.1"
                        min=""
                        value={form.ranking[key]}
                        onChange={(value) => update('ranking', { [key]: value })}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}

          {tab === 'pause' ? (
            <Card>
              <CardHeader>
                <CardTitle>Pause a service</CardTitle>
                <CardDescription>
                  For outages or bad weather. While a service is paused, riders get no new offers for it. Jobs already
                  under way carry on.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-gray-900">
                <SettingsCheckboxOption
                  id="maintenance-ride"
                  checked={form.pause.RIDE}
                  onChange={(RIDE) => update('pause', { RIDE })}
                  variant="warning"
                  title="Pause rides"
                  description="No new passenger rides are offered to riders."
                  activeHint="Rides are paused (once saved)."
                />
                <SettingsCheckboxOption
                  id="maintenance-delivery"
                  checked={form.pause.DELIVERY}
                  onChange={(DELIVERY) => update('pause', { DELIVERY })}
                  variant="warning"
                  title="Pause parcels"
                  description="No new parcel deliveries are offered to riders."
                  activeHint="Parcels are paused (once saved)."
                />
                <SettingsCheckboxOption
                  id="maintenance-food"
                  checked={form.pause.FOOD}
                  onChange={(FOOD) => update('pause', { FOOD })}
                  variant="warning"
                  title="Pause store deliveries"
                  description="No new store-delivery jobs are offered to riders. Stores can still receive orders."
                  activeHint="Store deliveries are paused (once saved)."
                />
              </CardContent>
            </Card>
          ) : null}

          {tab === 'stores' ? (
            <>
              <FoodPromoBannersCard />
              <MenuCategoryLayoutsCard />
            </>
          ) : null}

          {tab === 'sounds' ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5 text-orange-500" />
                    Store new-order sound
                  </CardTitle>
                  <CardDescription>
                    Plays on loop on the store&apos;s orders screen when a new order arrives, until the store accepts or
                    declines it.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SettingsAudioUpload
                    idPrefix="kitchen"
                    url={kitchenSoundUrl}
                    onUrlChange={setKitchenSoundUrl}
                    placeholder="/sounds/new-order.mp3"
                    helpText="Upload a file, or paste a path on this API (e.g. /sounds/new-order.mp3) or a full https:// link."
                    uploading={uploadingSound}
                    saving={saving}
                    onUpload={(file) =>
                      uploadSound(
                        file,
                        'kitchen-alert-sound',
                        setKitchenSoundUrl,
                        setUploadingSound,
                        'Store sound uploaded. Every store will use it.'
                      )
                    }
                    onSaveUrl={() => saveSoundUrl('kitchenAlertSoundUrl', kitchenSoundUrl, '/sounds/new-order.mp3')}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5 text-blue-500" />
                    Rider offer sound
                  </CardTitle>
                  <CardDescription>
                    Plays on loop in the rider app while an offer is waiting, until it&apos;s accepted, dismissed or
                    expires.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SettingsAudioUpload
                    idPrefix="rider"
                    url={riderSoundUrl}
                    onUrlChange={setRiderSoundUrl}
                    placeholder="/sounds/rider.mp3"
                    helpText="Upload a file, or paste a path on this API (e.g. /sounds/rider.mp3) or a full https:// link."
                    uploading={uploadingRiderSound}
                    saving={saving}
                    onUpload={(file) =>
                      uploadSound(
                        file,
                        'rider-alert-sound',
                        setRiderSoundUrl,
                        setUploadingRiderSound,
                        'Rider sound uploaded. Every rider app will use it.'
                      )
                    }
                    onSaveUrl={() => saveSoundUrl('riderAlertSoundUrl', riderSoundUrl, '/sounds/rider.mp3')}
                  />
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {form && tabHasForm ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur md:left-64">
          <div className="flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
            <p className={`mr-auto text-sm ${dirty ? 'font-medium text-amber-700' : 'text-gray-500'}`}>
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </p>
            {dirty ? (
              <Button variant="outline" onClick={discard} disabled={saving}>
                <RotateCcw className="mr-2 h-4 w-4" /> Discard
              </Button>
            ) : null}
            <Button onClick={saveTab} disabled={!dirty || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  step = '1',
  min = '0',
  max,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" step={step} min={min || undefined} max={max} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
