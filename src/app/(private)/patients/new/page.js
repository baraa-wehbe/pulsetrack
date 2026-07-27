import { redirect } from "next/navigation";

export const metadata = {
  title: "New patient | PulseTrack",
};

export default function NewPatientPage() {
  redirect("/patients");
}
