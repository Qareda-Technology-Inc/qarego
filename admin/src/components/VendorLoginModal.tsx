"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, MessageCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export type VendorLogin = {
  name?: string;
  phone?: string | null;
  username: string;
  tempPassword: string;
  sms: { sent: boolean; reason?: string };
  /** Merchant portal sign-in link, from the server's MERCHANT_ORIGIN. */
  portalUrl?: string | null;
  reason: "invite" | "reset";
};

/**
 * Shown once after inviting a vendor or resetting their password. The temporary password
 * isn't stored anywhere readable, so this is the only time an admin can see it.
 */
export function VendorLoginModal({ login, onClose }: { login: VendorLogin | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!login) return null;

  const portal = login.portalUrl || "";
  const message =
    `${login.reason === "reset" ? "Your QareGO store password was reset." : "Your QareGO store account is ready."}\n` +
    (portal ? `Sign in: ${portal}\n` : "") +
    `Username: ${login.username}\nTemporary password: ${login.tempPassword}\n` +
    "You'll choose your own password when you sign in.";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the details are on screen */
    }
  };

  const digits = login.phone?.replace(/\D/g, "");

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={login.reason === "reset" ? "New temporary password" : "Vendor invited"}
    >
      <div className="space-y-4">
        {login.sms.sent ? (
          <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              We texted the sign-in details to <strong>{login.phone}</strong>. They&apos;ll choose their own password
              when they sign in.
            </span>
          </div>
        ) : (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {login.sms.reason || "The text message couldn't be sent"}. Send the details below yourself, by WhatsApp
              or a call.
            </span>
          </div>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          {login.name ? (
            <>
              <dt className="text-gray-500">Vendor</dt>
              <dd className="text-gray-900">{login.name}</dd>
            </>
          ) : null}
          <dt className="text-gray-500">Username</dt>
          <dd className="font-mono text-gray-900">{login.username}</dd>
          <dt className="text-gray-500">Temporary password</dt>
          <dd className="font-mono text-base font-semibold tracking-wider text-gray-900">{login.tempPassword}</dd>
        </dl>
        <p className="text-xs text-gray-500">
          This password is only shown now. If it&apos;s lost, use Reset password to send a new one.
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={copy}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            {copied ? "Copied" : "Copy details"}
          </Button>
          {digits ? (
            <a
              href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
            >
              <MessageCircle className="mr-1 h-4 w-4" /> Send on WhatsApp
            </a>
          ) : null}
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}

