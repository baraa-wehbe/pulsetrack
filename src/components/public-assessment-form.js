"use client";

import { useState } from "react";

import InlineSpinner from "@/components/inline-spinner";

export default function PublicAssessmentForm({ messages, questionnaire }) {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (Object.keys(answers).length !== questionnaire.items.length) {
      setError(messages.assessmentEveryQuestionRequired);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/assessment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questionnaire.items.map(({ id }) => ({
            questionId: id,
            value: answers[id],
          })),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(
          result.code === "INVALID_ANSWERS"
            ? messages.assessmentEveryQuestionRequired
            : messages.publicAssessmentUnavailableDescription,
        );
        return;
      }

      setCompleted(true);
    } catch {
      setError(messages.publicAssessmentSubmitError);
    } finally {
      setPending(false);
    }
  };

  if (completed) {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        role="status"
      >
        <h1 className="text-2xl font-bold">
          {messages.publicAssessmentCompleteTitle}
        </h1>
        <p className="mt-2">{messages.publicAssessmentCompleteDescription}</p>
      </div>
    );
  }

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      {questionnaire.items.map((item, index) => (
        <fieldset
          className="rounded-xl border border-slate-200 p-5 dark:border-slate-700"
          key={item.id}
        >
          <legend className="px-1 font-bold text-slate-950 dark:text-white">
            <span className="text-teal-700 dark:text-teal-300">
              {index + 1}.
            </span>{" "}
            <bdi dir="auto">{item.text}</bdi>
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {questionnaire.options.map((option) => {
              const inputId = `${item.id}-${option.value}`;
              return (
                <label
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:has-[:checked]:border-teal-400 dark:has-[:checked]:bg-teal-950"
                  htmlFor={inputId}
                  key={option.value}
                >
                  <input
                    checked={answers[item.id] === option.value}
                    className="size-4 accent-teal-700"
                    id={inputId}
                    name={item.id}
                    onChange={() =>
                      setAnswers((current) => ({
                        ...current,
                        [item.id]: option.value,
                      }))
                    }
                    required
                    type="radio"
                    value={option.value}
                  />
                  <bdi dir="auto">{option.label}</bdi>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {error && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        aria-busy={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-700 px-5 py-3 font-bold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? <InlineSpinner /> : null}
        {pending
          ? messages.publicAssessmentSubmitting
          : messages.publicAssessmentSubmit}
      </button>
    </form>
  );
}
