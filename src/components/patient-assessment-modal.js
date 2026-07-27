"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  DIALOG_CLOSE_CLASS,
  DIALOG_CONTENT_CLASS,
  DIALOG_OVERLAY_CLASS,
} from "@/components/dialog-styles";
import PatientAssessmentForm from "@/components/patient-assessment-form";

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

export default function PatientAssessmentModal({
  messages,
  mode,
  patient,
  triggerClassName,
}) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const isScheduled = mode === "SCHEDULED";

  const resetAndClose = () => {
    setOpen(false);
    setFormKey((current) => current + 1);
  };

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setNotice("");
    } else {
      setFormKey((current) => current + 1);
    }
  };

  const handleSuccess = (outcome) => {
    resetAndClose();
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
    <>
      <Dialog.Root onOpenChange={handleOpenChange} open={open}>
        <Dialog.Trigger asChild>
          <button
            aria-label={`${
              isScheduled
                ? messages.scheduleQuestionnaireFor
                : messages.sendQuestionnaireTo
            } ${patient.mrn}`}
            className={triggerClassName}
            type="button"
          >
            {isScheduled ? messages.schedule : messages.send}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={DIALOG_OVERLAY_CLASS} />
          <Dialog.Content
            aria-describedby="assessment-dialog-description"
            className={`${DIALOG_CONTENT_CLASS} w-[min(94vw,38rem)]`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                  <bdi dir="ltr">{patient.mrn}</bdi>
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
                mode={mode}
                onCancel={resetAndClose}
                onSuccess={handleSuccess}
                patient={patient}
              />
            </div>
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
    </>
  );
}
