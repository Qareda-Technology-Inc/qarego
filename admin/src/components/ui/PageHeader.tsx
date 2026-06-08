import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">{title}</h2>
        {description ? (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">{actions}</div> : null}
    </div>
  );
}
