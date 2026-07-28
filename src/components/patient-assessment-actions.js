"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";

import {
  DIALOG_CLOSE_CLASS,
  DIALOG_CONTENT_CLASS,
  DIALOG_OVERLAY_CLASS,
} from "@/components/dialog-styles";
import { CONTROL_RADIUS_CLASS } from "@/components/control-styles";
import PatientAssessmentForm from "@/components/patient-assessment-form";

const AssessmentDialogContext = createContext(null);

const CloseIcon = () => (
  <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
    <path
      d="m6 6 12 12M18 6 6 18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
  </svg>
);

const useAssessmentDialog = () => {
  const context = useContext(AssessmentDialogContext);
  if (!context) {
    throw new Error(
      "PatientAssessmentActions must be rendered inside PatientAssessmentProvider.",
    );
  }
  return context;
};

export function PatientAssessmentProvider({ children, messages }) {
  const router = useRouter();
  const [selection, setSelection] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState("");
  const isScheduled = selection?.mode === "SCHEDULED";

  const closeAndReset = () => {
    setSelection(null);
    setFormKey((current) => current + 1);
  };

  const openAssessment = (patient, mode) => {
    setNotice("");
    setSelection({ mode, patient });
  };

  const handleSuccess = (outcome) => {
    closeAndReset();
    setNotice(
      outcome === "sent"
        ? messages.assessmentSentNotice
        : messages.assessmentScheduledNotice,
    );
    router.refresh();
  };

  const title = isScheduled
    ? messages.scheduleQuestionnaire
    : messages.sendQuestionnaire;
  const description = isScheduled
    ? messages.scheduleAssessmentDescription
    : messages.sendAssessmentDescription;

  return (
    <AssessmentDialogContext.Provider value={{ messages, openAssessment }}>
      {children}
      <Dialog.Root
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeAndReset();
        }}
        open={Boolean(selection)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={DIALOG_OVERLAY_CLASS} />
          <Dialog.Content
            aria-describedby="assessment-dialog-description"
            className={`${DIALOG_CONTENT_CLASS} w-[min(94vw,38rem)]`}
          >
            {selection ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                      <bdi dir="ltr">{selection.patient.mrn}</bdi>
                    </p>
                    <Dialog.Title className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                      {title}
                    </Dialog.Title>
                    <Dialog.Description
                      className="mt-2 text-sm text-slate-600 dark:text-slate-300"
                      id="assessment-dialog-description"
                    >
                      {description} {messages.singleUseAssessmentLink}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      aria-label={messages.closeAssessmentDialog}
                      className={DIALOG_CLOSE_CLASS}
                      type="button"
                    >
                      <CloseIcon />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="mt-5 border-t border-slate-200 pt-1 dark:border-slate-700">
                  <PatientAssessmentForm
                    key={formKey}
                    messages={messages}
                    mode={selection.mode}
                    onCancel={closeAndReset}
                    onSuccess={handleSuccess}
                    patient={selection.patient}
                  />
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {notice ? (
        <p
          className="fixed bottom-4 end-4 z-40 max-w-sm rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-950 shadow-lg dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100"
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </AssessmentDialogContext.Provider>
  );
}

export function PatientAssessmentActions({ align = "end", patient }) {
  const { messages, openAssessment } = useAssessmentDialog();

  return (
    <div
      className={`flex flex-wrap gap-2 ${
        align === "center" ? "justify-center" : "justify-end"
      }`}
    >
      <button
        aria-haspopup="dialog"
        aria-label={`${messages.sendQuestionnaireTo} ${patient.mrn}`}
        className={`${CONTROL_RADIUS_CLASS} border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-500 hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-teal-500 dark:hover:bg-teal-950 dark:hover:text-teal-100`}
        onClick={() => openAssessment(patient, "IMMEDIATE")}
        type="button"
      >
        {messages.send}
      </button>
      <button
        aria-haspopup="dialog"
        aria-label={`${messages.scheduleQuestionnaireFor} ${patient.mrn}`}
        className={`${CONTROL_RADIUS_CLASS} border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800`}
        onClick={() => openAssessment(patient, "SCHEDULED")}
        type="button"
      >
        {messages.schedule}
      </button>
    </div>
  );
}
