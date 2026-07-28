"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** md = default; lg = wider forms (e.g. store creation) */
  size?: "md" | "lg";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4">
      <div
        ref={modalRef}
        className={`bg-white shadow-2xl w-full overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl border border-border ${
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
      >
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-border shrink-0">
          <h3 className="text-lg font-semibold text-foreground pr-2">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 shrink-0 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
