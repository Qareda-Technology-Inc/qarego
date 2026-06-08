"use client";

import { useRef, useState } from "react";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { uploadImageFile, getMediaUploadBaseUrl } from "@/lib/uploadImage";
import {
  MAX_IMAGE_SIZE_LABEL,
  assertImageFileUnderLimit,
  imageSizeErrorMessage,
} from "@/lib/mediaLimits";
import { resolveImageUrl } from "@/lib/resolveImageUrl";
import { ImagePlus, Loader2, X } from "lucide-react";

type Props = {
  label: string;
  hint?: string;
  folder: string;
  value: string;
  onChange: (url: string) => void;
  aspect?: "square" | "wide";
};

export default function ImageUploadField({
  label,
  hint,
  folder,
  value,
  onChange,
  aspect = "square",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "warning"; text: string } | null>(null);

  const previewSrc = value ? resolveImageUrl(value) : "";

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const type = file.type.toLowerCase();
    const okType =
      type.startsWith("image/") &&
      !type.includes("heic") &&
      !type.includes("heif");
    if (!okType) {
      setStatus({
        type: "error",
        text: `Use JPG or PNG (under ${MAX_IMAGE_SIZE_LABEL}). iPhone HEIC often fails — in Photos choose “Most Compatible” or export as JPEG.`,
      });
      return;
    }
    try {
      assertImageFileUnderLimit(file);
    } catch (err) {
      setStatus({
        type: "error",
        text: err instanceof Error ? err.message : imageSizeErrorMessage(),
      });
      return;
    }
    setUploading(true);
    setStatus(null);
    try {
      const result = await uploadImageFile(file, folder);
      onChange(result.url);
      if (result.warning) {
        setStatus({ type: "warning", text: result.warning });
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Upload failed";
      setStatus({ type: "error", text });
    } finally {
      setUploading(false);
    }
  };

  const boxClass =
    aspect === "wide"
      ? "w-full max-w-md aspect-[2/1]"
      : "w-32 h-32";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-gray-600">{hint}</p> : null}
      <div className="flex flex-wrap items-start gap-4">
        <div
          className={`${boxClass} rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center`}
        >
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="h-8 w-8 text-gray-400" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4 mr-2" />
            )}
            {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </Button>
          {uploading ? (
            <p className="text-xs text-gray-500 max-w-xs">
              Sending to {getMediaUploadBaseUrl()} — can take up to a minute on slow networks.
            </p>
          ) : null}
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 justify-start"
              onClick={() => {
                onChange("");
                setStatus(null);
              }}
            >
              <X className="h-4 w-4 mr-1" /> Remove
            </Button>
          ) : null}
        </div>
      </div>
      {status ? (
        <p
          className={`text-xs max-w-lg ${
            status.type === "error" ? "text-red-600" : "text-amber-700"
          }`}
        >
          {status.text}
        </p>
      ) : null}
      {value ? (
        <p className="text-xs text-gray-500 break-all max-w-lg">Saved: {value}</p>
      ) : null}
    </div>
  );
}
