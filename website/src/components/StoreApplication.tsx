import { useRef, useState } from "react";
import { Icon } from "./Icons";

const STORE_TYPES = [
  { value: "FOOD", label: "Restaurant or kitchen" },
  { value: "GROCERY", label: "Grocery or shop" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "GAS", label: "Gas station" },
  { value: "OTHER", label: "Something else" },
] as const;

type Form = {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  storeType: string;
  area: string;
  message: string;
  website: string; // honeypot: hidden from people, bots fill it
};

const EMPTY: Form = {
  businessName: "",
  contactName: "",
  phone: "",
  email: "",
  storeType: "",
  area: "",
  message: "",
  website: "",
};

/** "List your store" button and the application form it opens. */
export function StoreApplication() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const open = () => {
    setError(null);
    if (state === "sent") {
      setForm(EMPTY);
      setState("idle");
    }
    dialog.current?.showModal();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeType) {
      setError("Choose what you sell.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/vendor-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.msg || data.message || "Something went wrong");
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "We couldn't send your application. Check your connection and try again."
      );
    }
  };

  return (
    <>
      <button type="button" className="btn btn--outline" onClick={open}>
        List your store <Icon name="arrow" />
      </button>

      <dialog
        ref={dialog}
        className="apply"
        aria-labelledby="apply-title"
        onClick={(e) => {
          // Clicking the dimmed backdrop closes it.
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="apply__inner">
          <button type="button" className="apply__close" aria-label="Close" onClick={() => dialog.current?.close()}>
            ×
          </button>

          {state === "sent" ? (
            <div className="apply__done" role="status">
              <span className="apply__tick">
                <Icon name="check" />
              </span>
              <h3 id="apply-title">Thanks, {form.contactName.split(" ")[0] || "we've got it"}!</h3>
              <p>
                We&apos;ll call you on <strong>{form.phone}</strong> to talk about {form.businessName}. Once we&apos;ve
                spoken, we&apos;ll text you a login for the QareGO merchant portal.
              </p>
              <button type="button" className="btn" onClick={() => dialog.current?.close()}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p className="eyebrow">For stores</p>
              <h3 id="apply-title">List your store on QareGO</h3>
              <p className="apply__lede">Tell us a little about your business. We&apos;ll call you to get you set up.</p>

              {error ? (
                <p className="apply__error" role="alert">
                  {error}
                </p>
              ) : null}

              <label className="apply__field">
                <span>Business name</span>
                <input required maxLength={120} value={form.businessName} onChange={set("businessName")} placeholder="Auntie Esi's Chop Bar" />
              </label>

              <fieldset className="apply__types">
                <legend>What do you sell?</legend>
                {STORE_TYPES.map((t) => (
                  <label key={t.value} className={form.storeType === t.value ? "is-on" : ""}>
                    <input
                      type="radio"
                      name="storeType"
                      value={t.value}
                      checked={form.storeType === t.value}
                      onChange={set("storeType")}
                    />
                    {t.label}
                  </label>
                ))}
              </fieldset>

              <div className="apply__row">
                <label className="apply__field">
                  <span>Your name</span>
                  <input required maxLength={80} autoComplete="name" value={form.contactName} onChange={set("contactName")} />
                </label>
                <label className="apply__field">
                  <span>Phone number</span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="024 123 4567"
                  />
                </label>
              </div>

              <div className="apply__row">
                <label className="apply__field">
                  <span>Town or area</span>
                  <input required maxLength={120} value={form.area} onChange={set("area")} placeholder="Osu, Accra" />
                </label>
                <label className="apply__field">
                  <span>
                    Email <em>(optional)</em>
                  </span>
                  <input type="email" maxLength={120} autoComplete="email" value={form.email} onChange={set("email")} />
                </label>
              </div>

              <label className="apply__field">
                <span>
                  Anything we should know? <em>(optional)</em>
                </span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={form.message}
                  onChange={set("message")}
                  placeholder="Number of branches, opening hours, what you deliver…"
                />
              </label>

              <label className="apply__hp" aria-hidden="true">
                Website
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
              </label>

              <button type="submit" className="btn apply__submit" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Send application"}
              </button>
              <p className="apply__fine">
                We only use these details to contact you about selling on QareGO. See our{" "}
                <a href="/privacy">privacy policy</a>.
              </p>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
