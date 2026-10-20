"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { uploadImageFile, getMediaUploadBaseUrl } from "@/lib/uploadImage";
import { IMAGE_SHAPES, loadImage, prepareImage, type ImageShapeName, type PixelArea } from "@/lib/prepareImage";
import { ImageCropModal } from "@/components/ImageCropModal";
import { resolveImageUrl } from "@/lib/resolveImageUrl";
import { ImagePlus, Loader2, X } from "lucide-react";

type Props = {
  label: string;
  hint?: string;
  folder: string;
  value: string;
  onChange: (url: string) => void;
  /** square = menu photos, wide = store cover (16:9), document = licences (no cropping) */
  aspect?: ImageShapeName;
};

const SHAPE_LABEL: Record<ImageShapeName, string> = {
  square: "square",
  wide: "wide banner",
  document: "document",
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
  // Big phone photos take a moment to open before the crop window can show them.
  const [opening, setOpening] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "warning"; text: string } | null>(null);

  const previewSrc = value ? resolveImageUrl(value) : "";

  const shape = IMAGE_SHAPES[aspect];
  // The photo waiting in the crop window.
  const [cropping, setCropping] = useState<{ img: HTMLImageElement; src: string; name: string } | null>(null);

  useEffect(() => {
    if (!cropping) return;
    return () => URL.revokeObjectURL(cropping.src);
  }, [cropping]);

  const upload = async (file: File) => {
    const result = await uploadImageFile(file, folder);
    onChange(result.url);
    if (result.warning) setStatus({ type: "warning", text: result.warning });
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus(null);
    let img: HTMLImageElement;
    setOpening(true);
    try {
      img = await loadImage(file);
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Couldn't open that image" });
      return;
    } finally {
      setOpening(false);
    }
    if (shape.crop) {
      setCropping({ img, src: URL.createObjectURL(file), name: file.name });
      return;
    }
    setUploading(true);
    try {
      await upload(await prepareImage(img, shape, undefined, file.name));
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const onCropped = async (area: PixelArea) => {
    if (!cropping) return;
    setUploading(true);
    try {
      await upload(await prepareImage(cropping.img, shape, area, cropping.name));
      setCropping(null);
    } catch (err) {
      setCropping(null);
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const boxClass =
    aspect === "wide"
      ? "w-full max-w-md aspect-video"
      : aspect === "document"
      ? "w-full max-w-md aspect-[3/2]"
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
            <img
              src={previewSrc}
              alt=""
              className={`w-full h-full ${aspect === "document" ? "object-contain" : "object-cover"}`}
            />
          ) : (
            <ImagePlus className="h-8 w-8 text-gray-400" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={onPick}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading || opening}
            onClick={() => inputRef.current?.click()}
          >
            {uploading || opening ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4 mr-2" />
            )}
            {opening ? "Opening photo…" : uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </Button>
          {uploading ? (
            <p className="text-xs text-muted max-w-xs">
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
        <p className="text-xs text-muted break-all max-w-lg">Saved: {value}</p>
      ) : null}
      {cropping && shape.crop ? (
        <ImageCropModal
          imageSrc={cropping.src}
          aspect={shape.aspect}
          shapeLabel={SHAPE_LABEL[aspect]}
          busy={uploading}
          onCancel={() => setCropping(null)}
          onConfirm={onCropped}
        />
      ) : null}
    </div>
  );
}
