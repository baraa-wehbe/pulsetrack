"use client";

import { useRouter } from "next/navigation";

import CustomDropdown from "@/components/custom-dropdown";

export default function PatientDashboardFilter({
  direction,
  messages,
  options,
  selectedPatientId,
}) {
  const router = useRouter();
  const selected = options.find(({ id }) => id === selectedPatientId);
  const items = [
    { label: messages.allPatients, searchText: "", value: "all" },
    ...options.map((patient) => ({
      label: `${patient.lastName}, ${patient.firstName} (${patient.mrn})`,
      searchText: `${patient.firstName} ${patient.lastName} ${patient.mrn}`,
      value: patient.id,
    })),
  ];

  return (
    <div>
      <label
        className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
        htmlFor="dashboard-patient"
      >
        {messages.selectPatient}
      </label>
      <div className="mt-2">
        <CustomDropdown
          direction={direction}
          id="dashboard-patient"
          items={items}
          noMatchesLabel={messages.noMatchingPatientsTitle}
          onValueChange={(value) =>
            router.replace(
              value === "all"
                ? "/dashboard/patient"
                : `/dashboard/patient?patient=${encodeURIComponent(value)}`,
            )
          }
          searchPlaceholder={messages.searchPatientsPlaceholder}
          searchable
          triggerLabel={
            selected
              ? `${selected.lastName}, ${selected.firstName} (${selected.mrn})`
              : messages.allPatients
          }
          value={selectedPatientId ?? "all"}
        />
      </div>
    </div>
  );
}
