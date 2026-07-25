"use client";

import { useState } from "react";

const PreferenceGroup = ({
  label,
  options,
  selectedValue,
  onSelect,
  disabled,
}) => (
  <div
    aria-label={label}
    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900"
    role="group"
  >
    {options.map(({ label: optionLabel, shortLabel, value }) => (
      <button
        aria-label={optionLabel}
        aria-pressed={selectedValue === value}
        className="min-h-8 rounded-md px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-wait disabled:opacity-60 aria-pressed:bg-white aria-pressed:text-teal-800 aria-pressed:shadow-sm dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:aria-pressed:bg-slate-700 dark:aria-pressed:text-teal-200"
        disabled={disabled}
        key={value}
        onClick={() => onSelect(value)}
        type="button"
      >
        {shortLabel}
      </button>
    ))}
  </div>
);

export default function PreferenceControls({ language, theme, messages }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updatePreference = async (kind, value, currentValue) => {
    if (value === currentValue || saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/private/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value }),
      });

      if (!response.ok) {
        throw new Error("Preference update failed.");
      }

      window.location.reload();
    } catch {
      setError(messages.preferenceError);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PreferenceGroup
        disabled={saving}
        label={messages.chooseLanguage}
        onSelect={(value) => updatePreference("language", value, language)}
        options={[
          { label: messages.english, shortLabel: "EN", value: "en" },
          { label: messages.arabic, shortLabel: "AR", value: "ar" },
        ]}
        selectedValue={language}
      />
      <PreferenceGroup
        disabled={saving}
        label={messages.chooseTheme}
        onSelect={(value) => updatePreference("theme", value, theme)}
        options={[
          {
            label: messages.light,
            shortLabel: messages.light,
            value: "light",
          },
          {
            label: messages.dark,
            shortLabel: messages.dark,
            value: "dark",
          },
        ]}
        selectedValue={theme}
      />
      {error ? (
        <span className="text-xs text-red-700 dark:text-red-300" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
