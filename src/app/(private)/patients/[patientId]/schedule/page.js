import { notFound, redirect } from "next/navigation";

import { patientIdentifierRouteParamsSchema } from "@/lib/patient-validation";

export const metadata = { title: "Schedule questionnaire | PulseTrack" };

export default async function ScheduleQuestionnairePage({ params }) {
  const parsed = patientIdentifierRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();

  redirect(`/patients/${encodeURIComponent(parsed.data.patientId)}`);
}
