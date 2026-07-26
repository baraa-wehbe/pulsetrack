import { notFound } from "next/navigation";

import PatientWorkflowPlaceholder from "@/components/patient-workflow-placeholder";
import { getTranslations } from "@/i18n/translations";
import { patientRouteParamsSchema } from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { getPatientById } from "@/server/patients/service";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = { title: "Send questionnaire | PulseTrack" };

export default async function SendQuestionnairePage({ params }) {
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
      description={messages.sendPlaceholderDescription}
      heading={messages.sendQuestionnaire}
      messages={messages}
      patient={patient}
    />
  );
}
