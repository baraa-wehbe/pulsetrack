"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CONTROL_RADIUS_CLASS } from "@/components/control-styles";
import {
  DIALOG_CLOSE_CLASS,
  DIALOG_CONTENT_CLASS,
  DIALOG_OVERLAY_CLASS,
} from "@/components/dialog-styles";
import PatientForm from "@/components/patient-form";

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

export default function NewPatientModal({ messages, today, triggerClassName }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [createdNotice, setCreatedNotice] = useState(false);

  const closeAndReset = () => {
    setOpen(false);
    setFormKey((current) => current + 1);
  };

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setCreatedNotice(false);
    } else {
      setFormKey((current) => current + 1);
    }
  };

  const handleSuccess = () => {
    closeAndReset();
    setCreatedNotice(true);
    router.refresh();
  };

  return (
    <>
      <Dialog.Root onOpenChange={handleOpenChange} open={open}>
        <Dialog.Trigger asChild>
          <button className={triggerClassName} type="button">
            {messages.newPatient}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={DIALOG_OVERLAY_CLASS} />
          <Dialog.Content className={DIALOG_CONTENT_CLASS}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {messages.createPatientHeading}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {messages.createPatientDescription}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label={messages.closePatientForm}
                  className={DIALOG_CLOSE_CLASS}
                  type="button"
                >
                  <CloseIcon />
                </button>
              </Dialog.Close>
            </div>
            <PatientForm
              key={formKey}
              messages={messages}
              mode="create"
              onCancel={closeAndReset}
              onSuccess={handleSuccess}
              controlRadiusClass={CONTROL_RADIUS_CLASS}
              today={today}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {createdNotice ? (
        <p
          className="fixed bottom-4 end-4 z-40 max-w-sm rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 shadow-lg dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100"
          role="status"
        >
          {messages.patientCreatedNotice}
        </p>
      ) : null}
    </>
  );
}
