"use client";

import { useEffect, useState } from "react";
import { fetcher } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Loader2, Plus, Trash2 } from "lucide-react";

export type ModifierOption = {
  _id?: string;
  name: string;
  priceDelta: number;
  isDefault?: boolean;
  isAvailable?: boolean;
};

export type ModifierGroup = {
  _id?: string;
  name: string;
  kind: "choose_one" | "add_ons";
  required: boolean;
  options: ModifierOption[];
};

type MenuItemRef = {
  _id: string;
  name: string;
  modifierGroups?: ModifierGroup[];
};

const emptyOption = (): ModifierOption => ({
  name: "",
  priceDelta: 0,
  isDefault: false,
  isAvailable: true,
});

const emptyGroup = (kind: ModifierGroup["kind"] = "choose_one"): ModifierGroup => ({
  name: "",
  kind,
  required: kind === "choose_one",
  options: [emptyOption()],
});

export default function MenuModifierEditor({
  item,
  open,
  onClose,
  onSaved,
}: {
  item: MenuItemRef | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item || !open) return;
    const initial = (item.modifierGroups || []).map((g) => ({
      ...g,
      options: (g.options || []).map((o) => ({ ...o })),
    }));
    setGroups(initial.length ? initial : []);
  }, [item, open]);

  const addGroup = (kind: ModifierGroup["kind"]) => {
    setGroups((prev) => [...prev, emptyGroup(kind)]);
  };

  const updateGroup = (index: number, patch: Partial<ModifierGroup>) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, ...patch } : g))
    );
  };

  const removeGroup = (index: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOption = (
    groupIndex: number,
    optionIndex: number,
    patch: Partial<ModifierOption>
  ) => {
    setGroups((prev) =>
      prev.map((g, gi) => {
        if (gi !== groupIndex) return g;
        return {
          ...g,
          options: g.options.map((o, oi) => (oi === optionIndex ? { ...o, ...patch } : o)),
        };
      })
    );
  };

  const addOption = (groupIndex: number) => {
    setGroups((prev) =>
      prev.map((g, gi) =>
        gi === groupIndex ? { ...g, options: [...g.options, emptyOption()] } : g
      )
    );
  };

  const removeOption = (groupIndex: number, optionIndex: number) => {
    setGroups((prev) =>
      prev.map((g, gi) => {
        if (gi !== groupIndex) return g;
        const next = g.options.filter((_, oi) => oi !== optionIndex);
        return { ...g, options: next.length ? next : [emptyOption()] };
      })
    );
  };

  const setDefaultOption = (groupIndex: number, optionIndex: number) => {
    setGroups((prev) =>
      prev.map((g, gi) => {
        if (gi !== groupIndex || g.kind !== "choose_one") return g;
        return {
          ...g,
          options: g.options.map((o, oi) => ({ ...o, isDefault: oi === optionIndex })),
        };
      })
    );
  };

  const save = async () => {
    if (!item) return;
    for (const group of groups) {
      if (!group.name.trim()) {
        alert("Every modifier group needs a name.");
        return;
      }
      const validOptions = group.options.filter((o) => o.name.trim());
      if (!validOptions.length) {
        alert(`"${group.name}" needs at least one option.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = groups.map((g) => ({
        _id: g._id,
        name: g.name.trim(),
        kind: g.kind,
        required: g.kind === "choose_one" ? g.required : false,
        options: g.options
          .filter((o) => o.name.trim())
          .map((o) => ({
            _id: o._id,
            name: o.name.trim(),
            priceDelta: Number(o.priceDelta) || 0,
            isDefault: g.kind === "choose_one" ? !!o.isDefault : false,
            isAvailable: o.isAvailable !== false,
          })),
      }));

      await fetcher(`/merchant/menu/${item._id}/modifiers`, {
        method: "PATCH",
        body: JSON.stringify({ modifierGroups: payload }),
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save modifiers");
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`Add-ons & options — ${item.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Let customers customize this dish — e.g. choose Fried or Grilled, add Extra Shito, or Add
          Egg with an extra charge.
        </p>

        {groups.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-4 text-center">
            No modifiers yet. Add a choice group or optional add-ons below.
          </p>
        ) : null}

        {groups.map((group, gi) => (
          <div key={group._id || `new-${gi}`} className="border rounded-xl p-4 space-y-3 bg-gray-50/50">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label>Group name</Label>
                <Input
                  value={group.name}
                  onChange={(e) => updateGroup(gi, { name: e.target.value })}
                  placeholder={group.kind === "choose_one" ? "e.g. Preparation" : "e.g. Extras"}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-red-600 shrink-0"
                onClick={() => removeGroup(gi)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-gray-500">
              {group.kind === "choose_one"
                ? "Customer picks one option (e.g. Fried or Grilled)."
                : "Customer can tick multiple add-ons with optional extra charges."}
            </p>

            {group.kind === "choose_one" ? (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={group.required}
                  onChange={(e) => updateGroup(gi, { required: e.target.checked })}
                />
                Required — customer must choose one
              </label>
            ) : null}

            <div className="space-y-2">
              <Label>Options</Label>
              {group.options.map((opt, oi) => (
                <div key={opt._id || `opt-${oi}`} className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[140px]">
                    <Input
                      value={opt.name}
                      onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                      placeholder="Option name"
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(opt.priceDelta ?? 0)}
                      onChange={(e) =>
                        updateOption(gi, oi, { priceDelta: Number(e.target.value) || 0 })
                      }
                      placeholder="+GH₵"
                    />
                  </div>
                  {group.kind === "choose_one" ? (
                    <label className="flex items-center gap-1 text-xs text-gray-600 pb-2">
                      <input
                        type="radio"
                        name={`default-${gi}`}
                        checked={!!opt.isDefault}
                        onChange={() => setDefaultOption(gi, oi)}
                      />
                      Default
                    </label>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={() => removeOption(gi, oi)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addOption(gi)}>
                <Plus className="h-3 w-3 mr-1" />
                Add option
              </Button>
              {group.options.some((o) => o.priceDelta > 0) ? (
                <p className="text-xs text-gray-500">
                  Extra charges are added to the dish base price at checkout.
                </p>
              ) : null}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => addGroup("choose_one")}>
            <Plus className="h-4 w-4 mr-1" />
            Choice group
          </Button>
          <Button type="button" variant="outline" onClick={() => addGroup("add_ons")}>
            <Plus className="h-4 w-4 mr-1" />
            Add-ons group
          </Button>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={save}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save modifiers"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function modifierSummary(groups: ModifierGroup[] = []) {
  if (!groups.length) return null;
  const parts = groups.map((g) => {
    const count = g.options?.length || 0;
    return `${g.name} (${count})`;
  });
  return parts.join(" · ");
}
