
"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { CURRENCY_SYMBOL } from '@/lib/currency';
import { fetcher } from '@/lib/api';
import { Save, Loader2, Volume2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';
import { SettingsCheckboxOption } from '@/components/SettingsCheckboxOption';
import { SettingsAudioUpload } from '@/components/SettingsAudioUpload';
import { MenuCategoryLayoutsCard } from '@/components/MenuCategoryLayoutsCard';
import { FoodPromoBannersCard } from '@/components/FoodPromoBannersCard';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<{
    commissionRate?: number;
    commissionByService?: Record<string, number>;
    debtLimit?: number;
    fareRates?: Record<string, { baseFare: number; perKmRate: number; minimumFare: number }>;
    kitchenAlertSoundUrl?: string;
    riderAlertSoundUrl?: string;
    foodServiceFeeRate?: number;
    foodServiceFeeMin?: number;
    foodServiceFeeMax?: number;
    vehicleCapabilityPolicy?: { pragyaFoodEnabled?: boolean; comfortFoodEnabled?: boolean };
    serviceMaintenance?: Record<string, boolean>;
    dispatchRankingWeights?: Record<string, number>;
  }>({});
  const [reliabilityPolicy, setReliabilityPolicy] = useState({
    strikesBeforePause: "5",
    pauseDurationHours: "24",
    strikeDecayOnCompletion: "1",
  });
  const [rankingWeights, setRankingWeights] = useState({
    fareWeight: "1",
    earningsPerKmWeight: "8",
    pickupPenaltyPerKm: "4",
    urgencyWeight: "10",
    foodReadyBoost: "12",
    maxPickupKm: "25",
  });
  const [vehiclePolicy, setVehiclePolicy] = useState({
    pragyaFoodEnabled: false,
    comfortFoodEnabled: false,
  });
  const [serviceMaintenance, setServiceMaintenance] = useState({
    RIDE: false,
    DELIVERY: false,
    FOOD: false,
  });
  const [kitchenSoundUrl, setKitchenSoundUrl] = useState('/sounds/new-order.mp3');
  const [riderSoundUrl, setRiderSoundUrl] = useState('/sounds/rider.mp3');
  const [uploadingSound, setUploadingSound] = useState(false);
  const [uploadingRiderSound, setUploadingRiderSound] = useState(false);
  const [settings, setSettings] = useState({
    commissionRate: '0.15',
    commissionRide: '0.15',
    commissionDelivery: '0.15',
    commissionFood: '0.15',
    debtLimit: '-100',
    foodServiceFeeRate: '0.08',
    foodServiceFeeMin: '2',
    foodServiceFeeMax: '12',
    supportEmail: 'support@qarego.com',
    platformName: 'QareGO',
  });
  const [fareRates, setFareRates] = useState<Record<string, { baseFare: string; perKmRate: string; minimumFare: string }>>({
    motorcycle: { baseFare: '8', perKmRate: '4', minimumFare: '20' },
    pragya: { baseFare: '12', perKmRate: '6', minimumFare: '28' },
    comfort: { baseFare: '18', perKmRate: '9', minimumFare: '45' },
  });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetcher('/admin/settings');
        setGlobalSettings(data);
        setKitchenSoundUrl(data.kitchenAlertSoundUrl || '/sounds/new-order.mp3');
        setRiderSoundUrl(data.riderAlertSoundUrl || '/sounds/rider.mp3');
        setSettings(prev => ({
          ...prev,
          commissionRate: String(data.commissionRate ?? 0.15),
          commissionRide: String(data.commissionByService?.RIDE ?? data.commissionRate ?? 0.15),
          commissionDelivery: String(data.commissionByService?.DELIVERY ?? data.commissionRate ?? 0.15),
          commissionFood: String(data.commissionByService?.FOOD ?? data.commissionRate ?? 0.15),
          debtLimit: String(data.debtLimit ?? -100),
          foodServiceFeeRate: String(data.foodServiceFeeRate ?? 0.08),
          foodServiceFeeMin: String(data.foodServiceFeeMin ?? 2),
          foodServiceFeeMax: String(data.foodServiceFeeMax ?? 12),
        }));
        if (data.fareRates && typeof data.fareRates === 'object') {
          const next: Record<string, { baseFare: string; perKmRate: string; minimumFare: string }> = {};
          ['motorcycle', 'pragya', 'comfort'].forEach((v) => {
            const r = data.fareRates[v];
            next[v] = {
              baseFare: r?.baseFare != null ? String(r.baseFare) : (v === 'motorcycle' ? '8' : v === 'pragya' ? '12' : '18'),
              perKmRate: r?.perKmRate != null ? String(r.perKmRate) : (v === 'motorcycle' ? '4' : v === 'pragya' ? '6' : '9'),
              minimumFare: r?.minimumFare != null ? String(r.minimumFare) : (v === 'motorcycle' ? '20' : v === 'pragya' ? '28' : '45'),
            };
          });
          setFareRates(next);
        }
        const vcp = data.vehicleCapabilityPolicy || {};
        setVehiclePolicy({
          pragyaFoodEnabled: !!vcp.pragyaFoodEnabled,
          comfortFoodEnabled: !!vcp.comfortFoodEnabled,
        });
        const sm = data.serviceMaintenance || {};
        setServiceMaintenance({
          RIDE: !!sm.RIDE,
          DELIVERY: !!sm.DELIVERY,
          FOOD: !!sm.FOOD,
        });
        const rw = data.dispatchRankingWeights || {};
        const rp = data.reliabilityPolicy || {};
        setReliabilityPolicy({
          strikesBeforePause: String(rp.strikesBeforePause ?? 5),
          pauseDurationHours: String(rp.pauseDurationHours ?? 24),
          strikeDecayOnCompletion: String(rp.strikeDecayOnCompletion ?? 1),
        });
        setRankingWeights({
          fareWeight: String(rw.fareWeight ?? 1),
          earningsPerKmWeight: String(rw.earningsPerKmWeight ?? 8),
          pickupPenaltyPerKm: String(rw.pickupPenaltyPerKm ?? 4),
          urgencyWeight: String(rw.urgencyWeight ?? 10),
          foodReadyBoost: String(rw.foodReadyBoost ?? 12),
          maxPickupKm: String(rw.maxPickupKm ?? 25),
        });
      } catch (e) {
        console.error('Failed to load global settings', e);
      } finally {
        setLoadingGlobal(false);
      }
    };
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleFareChange = (vehicle: string, field: string, value: string) => {
    setFareRates(prev => ({
      ...prev,
      [vehicle]: { ...prev[vehicle], [field]: value },
    }));
  };

  const patchSettings = async (payload: Record<string, unknown>, successMessage: string) => {
    setLoading(true);
    try {
      await fetcher('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
      alert(successMessage);
    } catch (e) {
      console.error(e);
      alert('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFareRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> = {};
      ['motorcycle', 'pragya', 'comfort'].forEach((v) => {
        payload[v] = {
          baseFare: parseFloat(fareRates[v]?.baseFare || '0') || 0,
          perKmRate: parseFloat(fareRates[v]?.perKmRate || '0') || 0,
          minimumFare: parseFloat(fareRates[v]?.minimumFare || '0') || 0,
        };
      });
      await fetcher('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ fareRates: payload }),
      });
      alert('Fare rates saved.');
    } catch (e) {
      console.error(e);
      alert('Failed to save fare rates.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKitchenSoundUrl = async () => {
    setLoading(true);
    try {
      await fetcher('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ kitchenAlertSoundUrl: kitchenSoundUrl.trim() || '/sounds/new-order.mp3' }),
      });
      alert('Kitchen alert sound URL saved.');
    } catch (e) {
      console.error(e);
      alert('Failed to save kitchen alert sound URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadKitchenSound = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      alert('Please choose an audio file (mp3, wav, etc.)');
      return;
    }
    setUploadingSound(true);
    try {
      const form = new FormData();
      form.append('sound', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch(`${getApiBaseUrl()}/admin/settings/kitchen-alert-sound`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      const pathUrl = data.kitchenAlertSoundUrl || '/sounds/new-order.mp3';
      setKitchenSoundUrl(pathUrl);
      alert('Kitchen alert sound uploaded. All merchant kitchens will use this file.');
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingSound(false);
    }
  };

  const handleSaveRiderSoundUrl = async () => {
    setLoading(true);
    try {
      await fetcher('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ riderAlertSoundUrl: riderSoundUrl.trim() || '/sounds/rider.mp3' }),
      });
      alert('Rider alert sound URL saved.');
    } catch (e) {
      console.error(e);
      alert('Failed to save rider alert sound URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadRiderSound = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      alert('Please choose an audio file (mp3, wav, etc.)');
      return;
    }
    setUploadingRiderSound(true);
    try {
      const form = new FormData();
      form.append('sound', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch(`${getApiBaseUrl()}/admin/settings/rider-alert-sound`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      const pathUrl = data.riderAlertSoundUrl || '/sounds/rider.mp3';
      setRiderSoundUrl(pathUrl);
      alert('Rider alert sound uploaded. All rider apps will use this file.');
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingRiderSound(false);
    }
  };

  const handleSubmitGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    await patchSettings(
      {
        commissionRate: parseFloat(settings.commissionRate) || 0.15,
        debtLimit: parseFloat(settings.debtLimit) ?? -100,
      },
      'Global commission and debt limit saved.'
    );
  };

  const handleSaveCommissionByService = async () => {
    await patchSettings(
      {
        commissionByService: {
          RIDE: parseFloat(settings.commissionRide) || 0.15,
          DELIVERY: parseFloat(settings.commissionDelivery) || 0.15,
          FOOD: parseFloat(settings.commissionFood) || 0.15,
        },
      },
      'Service commission saved.'
    );
  };

  const handleSaveVehiclePolicy = async () => {
    await patchSettings(
      { vehicleCapabilityPolicy: vehiclePolicy },
      'Vehicle capability policy saved.'
    );
  };

  const handleSaveReliabilityPolicy = async () => {
    await patchSettings(
      {
        reliabilityPolicy: {
          strikesBeforePause: parseInt(reliabilityPolicy.strikesBeforePause, 10) || 5,
          pauseDurationHours: parseInt(reliabilityPolicy.pauseDurationHours, 10) || 24,
          strikeDecayOnCompletion: parseInt(reliabilityPolicy.strikeDecayOnCompletion, 10) || 1,
        },
      },
      "Reliability policy saved."
    );
  };

  const handleSaveRankingWeights = async () => {
    await patchSettings(
      {
        dispatchRankingWeights: {
          fareWeight: parseFloat(rankingWeights.fareWeight) || 1,
          earningsPerKmWeight: parseFloat(rankingWeights.earningsPerKmWeight) || 8,
          pickupPenaltyPerKm: parseFloat(rankingWeights.pickupPenaltyPerKm) || 4,
          urgencyWeight: parseFloat(rankingWeights.urgencyWeight) || 10,
          foodReadyBoost: parseFloat(rankingWeights.foodReadyBoost) || 12,
          maxPickupKm: parseFloat(rankingWeights.maxPickupKm) || 25,
        },
      },
      "Dispatch ranking weights saved."
    );
  };

  const handleSaveServiceMaintenance = async () => {
    await patchSettings(
      { serviceMaintenance },
      'Service maintenance flags saved.'
    );
  };

  const handleSaveFoodServiceFee = async () => {
    await patchSettings(
      {
        foodServiceFeeRate: parseFloat(settings.foodServiceFeeRate) || 0.08,
        foodServiceFeeMin: parseFloat(settings.foodServiceFeeMin) || 2,
        foodServiceFeeMax: parseFloat(settings.foodServiceFeeMax) || 12,
      },
      'Food service fee settings saved.'
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <a href="/dispatch" className="text-sm text-blue-600 hover:underline">
          Rider dispatch overview →
        </a>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Commission & Debt Limit (Global)</CardTitle>
            <CardDescription>
              Baseline platform commission and debt policy. Riders are suspended when balance drops below debt limit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingGlobal ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commissionRate">Commission Rate (0–1)</Label>
                    <Input id="commissionRate" name="commissionRate" type="number" step="0.01" min="0" max="1" value={settings.commissionRate} onChange={handleChange} />
                    <p className="text-xs text-gray-500">e.g. 0.15 = 15%</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="debtLimit">Debt Limit ({CURRENCY_SYMBOL})</Label>
                    <Input id="debtLimit" name="debtLimit" type="number" value={settings.debtLimit} onChange={handleChange} />
                    <p className="text-xs text-gray-500">Driver suspended when balance &lt; this (e.g. -100)</p>
                  </div>
                  <div>
                    <Button type="button" onClick={handleSubmitGlobal} disabled={loading}>
                      {loading ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Commission & Debt</>}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commission by service</CardTitle>
            <CardDescription>
              Override rider commission per service type. If not set, global commission applies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commissionRide">Ride (RIDE)</Label>
                <Input
                  id="commissionRide"
                  name="commissionRide"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.commissionRide}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionDelivery">Parcel (DELIVERY)</Label>
                <Input
                  id="commissionDelivery"
                  name="commissionDelivery"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.commissionDelivery}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionFood">Food (FOOD)</Label>
                <Input
                  id="commissionFood"
                  name="commissionFood"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.commissionFood}
                  onChange={handleChange}
                />
              </div>
            </div>
            <Button type="button" onClick={handleSaveCommissionByService} disabled={loading}>
              {loading ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Service Commission</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle capability (rider dispatch)</CardTitle>
            <CardDescription>
              Motorcycle riders always receive ride, parcel, and food offers. Enable food for Pragya or Comfort when policy allows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-gray-900">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-gray-800 leading-relaxed">
              <p className="font-semibold text-gray-900 mb-2">Enable food delivery for a car (Comfort) rider</p>
              <ol className="list-decimal list-inside space-y-1.5 text-gray-800">
                <li>
                  Turn on <strong>Comfort — food delivery offers</strong> below, then click{" "}
                  <strong>Save vehicle policy</strong>.
                </li>
                <li>
                  In <strong>Drivers</strong> → edit the rider → set vehicle type to{" "}
                  <strong>Comfort (Car)</strong> and status <strong>Active</strong>.
                </li>
                <li>
                  On the same driver page, under <strong>Work mode</strong>, enable{" "}
                  <strong>Food</strong> (or preset “All services” / “Food only”).
                </li>
                <li>
                  Rider must go <strong>on duty</strong> in the app with food enabled in work mode.
                </li>
              </ol>
              <p className="mt-2 text-gray-700">
                Motorcycle riders always receive food offers. Pragya needs the Pragya food toggle above.
              </p>
            </div>
            <SettingsCheckboxOption
              id="pragyaFoodEnabled"
              checked={vehiclePolicy.pragyaFoodEnabled}
              onChange={(checked) =>
                setVehiclePolicy((p) => ({ ...p, pragyaFoodEnabled: checked }))
              }
              title="Pragya — food delivery offers"
              description="When enabled, Pragya (tricycle) riders can receive food courier jobs. Off by default; motorcycle is the primary food vehicle."
              activeHint="Pragya riders may receive FOOD offers when their work mode includes food."
            />
            <SettingsCheckboxOption
              id="comfortFoodEnabled"
              checked={vehiclePolicy.comfortFoodEnabled}
              onChange={(checked) =>
                setVehiclePolicy((p) => ({ ...p, comfortFoodEnabled: checked }))
              }
              title="Comfort — food delivery offers"
              description="When enabled, Comfort (car) riders can receive food courier jobs. Off by default."
              activeHint="Comfort riders may receive FOOD offers when their work mode includes food."
            />
            <Button type="button" onClick={handleSaveVehiclePolicy} disabled={loading} className="mt-2">
              {loading ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save vehicle policy</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rider reliability policy</CardTitle>
            <CardDescription>
              Missed offers (timer expires or dismiss) add strikes per service. Completing trips reduces strikes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Strikes before pause</Label>
                <Input
                  type="number"
                  min="1"
                  value={reliabilityPolicy.strikesBeforePause}
                  onChange={(e) =>
                    setReliabilityPolicy((p) => ({ ...p, strikesBeforePause: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Pause duration (hours)</Label>
                <Input
                  type="number"
                  min="1"
                  value={reliabilityPolicy.pauseDurationHours}
                  onChange={(e) =>
                    setReliabilityPolicy((p) => ({ ...p, pauseDurationHours: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Strike reduction per completion</Label>
                <Input
                  type="number"
                  min="0"
                  value={reliabilityPolicy.strikeDecayOnCompletion}
                  onChange={(e) =>
                    setReliabilityPolicy((p) => ({ ...p, strikeDecayOnCompletion: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button type="button" onClick={handleSaveReliabilityPolicy} disabled={loading}>
              {loading ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save reliability policy</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispatch ranking weights</CardTitle>
            <CardDescription>
              Tune how offers are scored and which riders get notified first. Higher score = offered sooner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(
                [
                  ["fareWeight", "Fare weight"],
                  ["earningsPerKmWeight", "Pay per km weight"],
                  ["pickupPenaltyPerKm", "Pickup distance penalty"],
                  ["urgencyWeight", "Urgency boost"],
                  ["foodReadyBoost", "Food ready boost"],
                  ["maxPickupKm", "Max pickup km"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    step="0.1"
                    value={rankingWeights[key]}
                    onChange={(e) =>
                      setRankingWeights((w) => ({ ...w, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <Button type="button" onClick={handleSaveRankingWeights} disabled={loading}>
              {loading ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save ranking weights</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service maintenance</CardTitle>
            <CardDescription>
              Pause offers platform-wide per service. Riders will not see matching offers while enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-gray-900">
            <SettingsCheckboxOption
              id="maintenance-ride"
              checked={serviceMaintenance.RIDE}
              onChange={(checked) =>
                setServiceMaintenance((m) => ({ ...m, RIDE: checked }))
              }
              variant="warning"
              title="Pause ride offers"
              description="Stops new passenger ride requests from being offered to riders platform-wide."
              activeHint="Ride service is in maintenance — no new ride offers will broadcast."
            />
            <SettingsCheckboxOption
              id="maintenance-delivery"
              checked={serviceMaintenance.DELIVERY}
              onChange={(checked) =>
                setServiceMaintenance((m) => ({ ...m, DELIVERY: checked }))
              }
              variant="warning"
              title="Pause parcel / courier offers"
              description="Stops parcel and non-food delivery trips from being offered to riders."
              activeHint="Parcel service is in maintenance — no new DELIVERY offers will broadcast."
            />
            <SettingsCheckboxOption
              id="maintenance-food"
              checked={serviceMaintenance.FOOD}
              onChange={(checked) =>
                setServiceMaintenance((m) => ({ ...m, FOOD: checked }))
              }
              variant="warning"
              title="Pause food delivery offers"
              description="Stops food courier jobs from being offered to riders (restaurants may still receive orders)."
              activeHint="Food courier service is in maintenance — no new FOOD offers will broadcast."
            />
            <Button type="button" onClick={handleSaveServiceMaintenance} disabled={loading} className="mt-2">
              {loading ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save maintenance</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Food service fee</CardTitle>
            <CardDescription>
              Platform fee on food subtotal, clamped between minimum and maximum.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="foodServiceFeeRate">Rate (0-1)</Label>
                <Input
                  id="foodServiceFeeRate"
                  name="foodServiceFeeRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.foodServiceFeeRate}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-500">8% = 0.08</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="foodServiceFeeMin">Minimum ({CURRENCY_SYMBOL})</Label>
                <Input
                  id="foodServiceFeeMin"
                  name="foodServiceFeeMin"
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.foodServiceFeeMin}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="foodServiceFeeMax">Maximum ({CURRENCY_SYMBOL})</Label>
                <Input
                  id="foodServiceFeeMax"
                  name="foodServiceFeeMax"
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.foodServiceFeeMax}
                  onChange={handleChange}
                />
              </div>
            </div>
            <Button type="button" onClick={handleSaveFoodServiceFee} disabled={loading}>
              {loading ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Food Service Fee</>}
            </Button>
          </CardContent>
        </Card>

        <MenuCategoryLayoutsCard />

        <FoodPromoBannersCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-orange-500" />
              Kitchen alert sound
            </CardTitle>
            <CardDescription>
              Plays on loop in the merchant kitchen when a new order arrives (until the store accepts or
              declines). Upload an mp3/wav or set a public URL path on this API server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsAudioUpload
              idPrefix="kitchen"
              url={kitchenSoundUrl}
              onUrlChange={setKitchenSoundUrl}
              placeholder="/sounds/new-order.mp3"
              helpText="Relative paths are served from this API (upload below → /sounds/new-order.mp3). You can also paste a full https:// URL."
              uploading={uploadingSound}
              saving={loading}
              onUpload={handleUploadKitchenSound}
              onSaveUrl={handleSaveKitchenSoundUrl}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-blue-500" />
              Rider alert sound
            </CardTitle>
            <CardDescription>
              Plays on loop in the rider app while ride, parcel, or food-delivery offers are waiting
              (until accepted, dismissed, or the offer expires). Default file: rider.mp3 on this API server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsAudioUpload
              idPrefix="rider"
              url={riderSoundUrl}
              onUrlChange={setRiderSoundUrl}
              placeholder="/sounds/rider.mp3"
              helpText="Relative paths are served from this API (upload below → /sounds/rider.mp3). Plays while offers are waiting in the rider app."
              uploading={uploadingRiderSound}
              saving={loading}
              onUpload={handleUploadRiderSound}
              onSaveUrl={handleSaveRiderSoundUrl}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fare by vehicle</CardTitle>
            <CardDescription>Base fare, per km rate, and minimum fare for each vehicle type. Used for ride cost calculation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveFareRates} className="space-y-6">
              {(['motorcycle', 'pragya', 'comfort'] as const).map((vehicle) => (
                <div key={vehicle} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 capitalize mb-3">{vehicle}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label>Base fare ({CURRENCY_SYMBOL})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={fareRates[vehicle]?.baseFare ?? ''}
                        onChange={(e) => handleFareChange(vehicle, 'baseFare', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Per km ({CURRENCY_SYMBOL})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={fareRates[vehicle]?.perKmRate ?? ''}
                        onChange={(e) => handleFareChange(vehicle, 'perKmRate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Minimum fare ({CURRENCY_SYMBOL})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={fareRates[vehicle]?.minimumFare ?? ''}
                        onChange={(e) => handleFareChange(vehicle, 'minimumFare', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save fare rates</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
