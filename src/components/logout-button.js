"use client";

import { useState } from "react";

import { CONTROL_RADIUS_CLASS } from "@/components/control-styles";
import InlineSpinner from "@/components/inline-spinner";

export default function LogoutButton({ messages, className = "" }) {
  const [submitting, setSubmitting] = useState(false);

  const logout = async () => {
    setSubmitting(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <button
      aria-busy={submitting}
      className={`${CONTROL_RADIUS_CLASS} inline-flex items-center justify-center gap-2 border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
      disabled={submitting}
      onClick={logout}
      type="button"
    >
      {submitting ? <InlineSpinner /> : null}
      {submitting ? messages.loggingOut : messages.logout}
    </button>
  );
}
