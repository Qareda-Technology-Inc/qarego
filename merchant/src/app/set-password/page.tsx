"use client";

import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { notify } from "@/lib/notify";

/** First sign-in (or after an admin reset): the vendor swaps the temporary password for their own. */
export default function SetPasswordPage() {
  const { user, logout, markPasswordChanged } = useAuth();
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-bold text-foreground">Choose your password</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          {user?.name ? `Welcome, ${user.name}. ` : ""}You signed in with a temporary password from QareGO. Choose your
          own to continue; only you will know it.
        </p>
        <ChangePasswordForm
          currentLabel="Temporary password (from the text message)"
          submitLabel="Save and continue"
          onDone={() => {
            markPasswordChanged();
            notify.success("Password saved");
            router.replace("/");
          }}
        />
        <button onClick={logout} className="mt-6 text-sm text-muted hover:text-foreground">
          Sign out
        </button>
      </div>
    </div>
  );
}
