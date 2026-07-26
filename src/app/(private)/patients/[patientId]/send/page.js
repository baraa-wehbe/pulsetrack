import { notFound } from "next/navigation";

import PatientAssessmentWorkflow from "@/components/patient-assessment-workflow";
import { getTranslations } from "@/i18n/translations";
import { patientIdentifierRouteParamsSchema } from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { getActivePatientForAssessment } from "@/server/assessments/service";
import { getRequestPreferences } from "@/server/preferences/current";

export const metadata = { title: "Send questionnaire | PulseTrack" };

export default async function SendQuestionnairePage({ params }) {
  const parsed = patientIdentifierRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const [{ language }, patient] = await Promise.all([
    getRequestPreferences(),
    getActivePatientForAssessment(prisma, parsed.data.patientId),
  ]);
  if (!patient) notFound();

  const messages = getTranslations(language);
  return (
    <>
      <title>{`${messages.sendQuestionnaire} | PulseTrack`}</title>
      <PatientAssessmentWorkflow
        description={messages.sendAssessmentDescription}
        heading={messages.sendQuestionnaire}
        messages={messages}
        mode="IMMEDIATE"
        patient={patient}
      />
    </>
  );
}
