import { Loader2 } from "lucide-react";

export default function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}
