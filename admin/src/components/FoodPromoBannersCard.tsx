"use client";

import { useEffect, useRef, useState } from "react";
import { fetcher } from "@/lib/api";
import { uploadMediaFile } from "@/lib/uploadMedia";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { MAX_IMAGE_SIZE_LABEL } from "@/lib/mediaLimits";

type BannerRow = {
  imageUrl: string;
  vertical: "ALL" | "FOOD" | "GROCERY" | "PHARMACY";
  enabled: boolean;
  sortOrder: number;
};

/** Match customer carousel card ratio (~2.4:1) */
const PROMO_BANNER_RECOMMENDED_W = 1080;
const PROMO_BANNER_RECOMMENDED_H = 450;
const PROMO_BANNER_ASPECT = `${PROMO_BANNER_RECOMMENDED_W} × ${PROMO_BANNER_RECOMMENDED_H}`;

const EMPTY_ROW = (): BannerRow => ({
  imageUrl: "",
  vertical: "ALL",
  enabled: true,
  sortOrder: 0,
});

export function FoodPromoBannersCard() {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    fetcher("/admin/settings")
      .then((data) => {
        if (Array.isArray(data.foodPromoBanners) && data.foodPromoBanners.length) {
          setRows(
            data.foodPromoBanners.map((b: BannerRow, i: number) => ({
              imageUrl: b.imageUrl || "",
              vertical: (b.vertical as BannerRow["vertical"]) || "ALL",
              enabled: b.enabled !== false,
              sortOrder: b.sortOrder ?? i,
            }))
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const uploadForRow = async (idx: number, file: File) => {
    setUploadingIdx(idx);
    try {
      const { url } = await uploadMediaFile(file, "promos/food");
      setRows((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], imageUrl: url };
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingIdx(null);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetcher("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          foodPromoBanners: rows
            .filter((r) => r.imageUrl.trim())
            .map((r, i) => ({
              imageUrl: r.imageUrl,
              vertical: r.vertical,
              enabled: r.enabled,
              sortOrder: r.sortOrder ?? i,
            })),
        }),
      });
      alert("Promo banners saved.");
    } catch {
      alert("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Food home promos</CardTitle>
        <CardDescription>
          Upload banner images only — put all text and offers in the image itself. JPG or PNG (max{" "}
          {MAX_IMAGE_SIZE_LABEL}). Recommended size: <strong>{PROMO_BANNER_ASPECT} px</strong>{" "}
          (landscape, ~2.4:1). Slides auto-rotate every 5.5 seconds; customers can also swipe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {rows.length === 0 ? (
              <p className="text-sm text-gray-600">No promos yet — add a banner below.</p>
            ) : null}
            {rows.map((row, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">Banner {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
                <div className="flex flex-wrap gap-4 items-start">
                  <div
                    className="w-64 rounded-lg border bg-white overflow-hidden flex items-center justify-center shrink-0"
                    style={{
                      aspectRatio: `${PROMO_BANNER_RECOMMENDED_W} / ${PROMO_BANNER_RECOMMENDED_H}`,
                    }}
                  >
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(row.imageUrl) || ""}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-400 px-2 text-center">
                        Preview ({PROMO_BANNER_ASPECT})
                      </span>
                    )}
                  </div>
                  <div className="space-y-3 min-w-[180px] flex-1">
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Design at <strong>{PROMO_BANNER_ASPECT} px</strong> (or same 2.4:1 ratio). The
                      preview matches the customer app — no extra text is added on top.
                    </p>
                    <input
                      ref={(el) => {
                        fileRefs.current[i] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) uploadForRow(i, f);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingIdx === i}
                      onClick={() => fileRefs.current[i]?.click()}
                    >
                      {uploadingIdx === i ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-1" />
                      )}
                      {row.imageUrl ? "Replace image" : "Upload image"}
                    </Button>
                    <div>
                      <Label>Show on</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm mt-1"
                        value={row.vertical}
                        onChange={(e) => {
                          const v = e.target.value as BannerRow["vertical"];
                          setRows((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i], vertical: v };
                            return next;
                          });
                        }}
                      >
                        <option value="ALL">All verticals</option>
                        <option value="FOOD">Food & Restaurants only</option>
                        <option value="GROCERY">Groceries & Supermarket only</option>
                        <option value="PHARMACY">Pharmacy only</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setRows((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i], enabled: v };
                            return next;
                          });
                        }}
                      />
                      Visible to customers
                    </label>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW(), sortOrder: prev.length }])}
              >
                <Plus className="w-4 h-4 mr-1" /> Add banner
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save promos
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
