"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * Let the vendor frame a photo to the shape the app shows. Drag to move, pinch / slider to zoom.
 * Returns the chosen area in the image's own pixels.
 */
export function ImageCropModal({
  imageSrc,
  aspect,
  shapeLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  imageSrc: string;
  aspect: number;
  shapeLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (area: Area) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  return (
    <Modal isOpen onClose={busy ? () => {} : onCancel} title="Crop your photo">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Drag to move and zoom to fit. Customers see it as a {shapeLabel}.
        </p>
        <div className="relative h-72 w-full overflow-hidden rounded-xl bg-slate-900 sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            objectFit="contain"
            showGrid
          />
        </div>
        <label className="flex items-center gap-3">
          <ZoomOut className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="w-full accent-blue-600"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => area && onConfirm(area)} disabled={busy || !area}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy ? "Saving…" : "Use photo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
