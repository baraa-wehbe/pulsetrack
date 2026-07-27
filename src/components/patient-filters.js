"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { CONTROL_RADIUS_CLASS } from "@/components/control-styles";
import CustomDropdown from "@/components/custom-dropdown";
import { FILTER_CONTROL_CLASS } from "@/components/filter-control-styles";
import {
  buildPatientListHref,
  PATIENT_BADGE_MAPPINGS,
} from "@/lib/patient-list";
import {
  PATIENT_LIST_DEFAULTS,
  PATIENT_ORIGIN_VALUES,
  PATIENT_OWNERSHIP_VALUES,
  PATIENT_PAGE_SIZE_VALUES,
  PATIENT_SYNC_STATUS_VALUES,
} from "@/lib/patient-validation";

const SEARCH_DEBOUNCE_MS = 400;

const filterLabel = (messages, kind, value) =>
  messages[PATIENT_BADGE_MAPPINGS[kind][value].translationKey];

const toFilterState = (query) => ({
  search: query.search,
  origin: query.origin,
  ownership: query.ownership,
  syncStatus: query.syncStatus,
  pageSize: query.pageSize,
});

export default function PatientFilters({ direction, messages, query }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState(() => toFilterState(query));
  const filtersRef = useRef(filters);
  const debounceRef = useRef(null);
  const lastRequestedHrefRef = useRef(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const replaceFilters = (next) => {
    const href = buildPatientListHref(
      { ...PATIENT_LIST_DEFAULTS, ...next },
      { page: 1 },
    );
    const browserHref = `${window.location.pathname}${window.location.search}`;
    if (href === browserHref || href === lastRequestedHrefRef.current) return;

    lastRequestedHrefRef.current = href;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  const updateFilters = (next) => {
    filtersRef.current = next;
    setFilters(next);
  };

  const handleSearchChange = (event) => {
    const next = { ...filtersRef.current, search: event.target.value };
    updateFilters(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      replaceFilters(next);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSelectChange = (name, value) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const next = {
      ...filtersRef.current,
      [name]: name === "pageSize" ? Number(value) : value,
    };
    updateFilters(next);
    replaceFilters(next);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    replaceFilters(filtersRef.current);
  };

  const handleClear = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const next = toFilterState(PATIENT_LIST_DEFAULTS);
    filtersRef.current = next;
    setFilters(next);
    lastRequestedHrefRef.current = "/patients";
  };

  return (
    <form
      aria-busy={isPending}
      className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="sm:col-span-2">
          <label
            className="block text-sm font-semibold"
            htmlFor="patient-search"
          >
            {messages.searchPatients}
          </label>
          <input
            className={`mt-2 w-full ${FILTER_CONTROL_CLASS}`}
            id="patient-search"
            maxLength={100}
            name="search"
            onChange={handleSearchChange}
            placeholder={messages.searchPatientsPlaceholder}
            type="search"
            value={filters.search}
          />
        </div>
        {[
          ["origin", messages.origin, PATIENT_ORIGIN_VALUES],
          ["ownership", messages.ownership, PATIENT_OWNERSHIP_VALUES],
          ["syncStatus", messages.syncStatus, PATIENT_SYNC_STATUS_VALUES],
        ].map(([name, label, values]) => (
          <div key={name}>
            <label
              className="block text-sm font-semibold"
              htmlFor={`patient-${name}`}
            >
              {label}
            </label>
            <div className="mt-2">
              <CustomDropdown
                direction={direction}
                id={`patient-${name}`}
                items={[
                  { label: messages.allOptions, value: "all" },
                  ...values.map((value) => ({
                    label: filterLabel(messages, name, value),
                    value,
                  })),
                ]}
                name={name}
                onValueChange={(value) => handleSelectChange(name, value)}
                triggerLabel={
                  filters[name] === "all"
                    ? messages.allOptions
                    : filterLabel(messages, name, filters[name])
                }
                value={filters[name]}
              />
            </div>
          </div>
        ))}
        <div>
          <label
            className="block text-sm font-semibold"
            htmlFor="patient-page-size"
          >
            {messages.pageSize}
          </label>
          <div className="mt-2">
            <CustomDropdown
              direction={direction}
              id="patient-page-size"
              items={PATIENT_PAGE_SIZE_VALUES.map((value) => ({
                label: String(value),
                value: String(value),
              }))}
              name="pageSize"
              onValueChange={(value) => handleSelectChange("pageSize", value)}
              triggerLabel={String(filters.pageSize)}
              value={String(filters.pageSize)}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end rtl:justify-start">
        <Link
          className={`inline-flex px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:text-teal-300 dark:hover:bg-teal-950 ${CONTROL_RADIUS_CLASS}`}
          href="/patients"
          onClick={handleClear}
        >
          {messages.clearPatientFiltersAction}
        </Link>
      </div>
    </form>
  );
}
