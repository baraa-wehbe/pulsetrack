"use client";

import { useState } from "react";

export default function LogoutButton() {
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
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      disabled={submitting}
      onClick={logout}
      type="button"
    >
      {submitting ? "Signing out…" : "Sign out"}
    </button>
  );
}
