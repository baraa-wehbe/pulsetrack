"use client";

import { useState } from "react";

export default function LoginForm({ messages, nextPath }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? messages.signInError);
        return;
      }

      window.location.assign(nextPath);
    } catch {
      setError(messages.signInError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
          htmlFor="email"
        >
          {messages.email}
        </label>
        <input
          autoComplete="username"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-teal-400 dark:focus:ring-teal-950"
          dir="ltr"
          id="email"
          maxLength={320}
          name="email"
          required
          type="email"
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
          htmlFor="password"
        >
          {messages.password}
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-teal-400 dark:focus:ring-teal-950"
          dir="ltr"
          id="password"
          maxLength={1024}
          name="password"
          required
          type="password"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
        disabled={submitting}
        type="submit"
      >
        {submitting ? messages.signingIn : messages.signIn}
      </button>
    </form>
  );
}
