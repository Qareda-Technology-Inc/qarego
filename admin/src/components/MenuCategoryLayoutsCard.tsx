"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

type LayoutRow = { name: string; displayLayout: "row" | "column" };

const DEFAULTS: LayoutRow[] = [
  { name: "Drinks", displayLayout: "row" },
  { name: "Sides", displayLayout: "row" },
  { name: "Mains", displayLayout: "column" },
];

export function MenuCategoryLayoutsCard() {
  const [rows, setRows] = useState<LayoutRow[]>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetcher("/admin/settings")
      .then((data) => {
        if (Array.isArray(data.menuCategoryLayouts) && data.menuCategoryLayouts.length) {
          setRows(
            data.menuCategoryLayouts.map((r: LayoutRow) => ({
              name: r.name || "",
              displayLayout: r.displayLayout === "row" ? "row" : "column",
            }))
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetcher("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          menuCategoryLayouts: rows.filter((r) => r.name.trim()),
        }),
      });
      alert("Menu category layout defaults saved.");
    } catch {
      alert("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Menu category layouts</CardTitle>
        <CardDescription>
          Default how customer menus display items by category name. Row = horizontal scroll (good
          for drinks/snacks). Column = 2-column grid. Merchants can override per category on their
          menu page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {rows.map((row, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[140px]">
                  <Label>Category name</Label>
                  <Input
                    value={row.name}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...next[i], name: e.target.value };
                      setRows(next);
                    }}
                    placeholder="Drinks"
                  />
                </div>
                <div>
                  <Label>Layout</Label>
                  <select
                    value={row.displayLayout}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = {
                        ...next[i],
                        displayLayout: e.target.value as "row" | "column",
                      };
                      setRows(next);
                    }}
                    className="flex h-10 rounded-md border border-gray-300 px-3 text-sm"
                  >
                    <option value="column">Column grid</option>
                    <option value="row">Row scroll</option>
                  </select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-red-600 mb-0.5"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRows([...rows, { name: "", displayLayout: "column" }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Add rule
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" /> Save layouts
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
