import { notFound } from "next/navigation";

import PatientWorkflowPlaceholder from "@/components/patient-workflow-placeholder";
import { getTranslations } from "@/i18n/translations";
import { patientRouteParamsSchema } from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { getPatientById } from "@/server/patients/service";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = { title: "Schedule questionnaire | PulseTrack" };

export default async function ScheduleQuestionnairePage({ params }) {
  const parsed = patientRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const [{ language }, patient] = await Promise.all([
    getRequestPreferences(),
    getPatientById(prisma, parsed.data.patientId),
  ]);
  if (!patient) notFound();

  const messages = getTranslations(language);
  return (
    <PatientWorkflowPlaceholder
      description={messages.schedulePlaceholderDescription}
      heading={messages.scheduleQuestionnaire}
      messages={messages}
      patient={patient}
    />
  );
}
