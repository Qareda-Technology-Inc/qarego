"use client";

import { resolveImageUrl } from "@/lib/resolveImageUrl";

export function PrescriptionAttachments({ urls }: { urls?: string[] | null }) {
  if (!urls?.length) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted uppercase tracking-wide">Prescription</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {urls.map((url) => {
          const src = resolveImageUrl(url);
          if (!src) return null;
          return (
            <a
              key={url}
              href={src}
              target="_blank"
              rel="noreferrer"
              className="block h-20 w-20 overflow-hidden rounded-xl border border-border bg-slate-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Prescription" className="h-full w-full object-cover" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
