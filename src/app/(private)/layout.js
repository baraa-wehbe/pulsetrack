import { requireCurrentClinician } from "@/server/auth/current-clinician";

export default async function PrivateLayout({ children }) {
  await requireCurrentClinician();

  return children;
}
