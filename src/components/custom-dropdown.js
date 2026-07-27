"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRef, useState } from "react";

import {
  FILTER_CONTROL_CLASS,
  FILTER_MENU_CLASS,
  FILTER_MENU_ITEM_CLASS,
} from "@/components/filter-control-styles";
import { navigationItemClass } from "@/components/navigation-styles";

const ChevronIcon = () => (
  <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
    <path
      d="m7 10 5 5 5-5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const optionClass = (selected) =>
  `${FILTER_MENU_ITEM_CLASS} flex w-full cursor-pointer items-center justify-between gap-3 ${
    selected
      ? "bg-teal-50 font-semibold text-teal-900 hover:bg-teal-50 focus:bg-teal-50 focus:text-teal-900 dark:bg-teal-950 dark:text-teal-100 dark:hover:bg-teal-950 dark:focus:bg-teal-950 dark:focus:text-teal-100"
      : ""
  }`;

export default function CustomDropdown({
  active = false,
  ariaLabel,
  direction,
  id,
  items,
  name,
  onValueChange,
  noMatchesLabel,
  searchPlaceholder,
  searchable = false,
  triggerLabel,
  value,
  variant = "form",
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);
  const navigation = variant === "navigation";
  const visibleItems =
    searchable && search
      ? items.filter((item) =>
          `${item.label} ${item.searchText ?? ""}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
        )
      : items;
  const triggerClassName = navigation
    ? `${navigationItemClass(active)} inline-flex items-center gap-1`
    : `${FILTER_CONTROL_CLASS} flex min-h-10 w-full items-center justify-between gap-2 text-start`;

  return (
    <DropdownMenu.Root dir={direction} onOpenChange={() => setSearch("")}>
      <DropdownMenu.Trigger
        aria-label={ariaLabel}
        className={triggerClassName}
        id={id}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronIcon />
      </DropdownMenu.Trigger>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          className={`${FILTER_MENU_CLASS} z-50 p-1.5 shadow-xl outline-none ${
            navigation
              ? "min-w-56"
              : "min-w-[var(--radix-dropdown-menu-trigger-width)]"
          }`}
          sideOffset={6}
          onOpenAutoFocus={(event) => {
            if (searchable) {
              event.preventDefault();
              searchRef.current?.focus();
            }
          }}
        >
          {searchable ? (
            <input
              aria-label={searchPlaceholder}
              className={`${FILTER_CONTROL_CLASS} mb-1 w-full`}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") event.stopPropagation();
              }}
              placeholder={searchPlaceholder}
              ref={searchRef}
              type="search"
              value={search}
            />
          ) : null}
          {navigation ? (
            visibleItems.map((item) => (
              <DropdownMenu.Item asChild key={item.href}>
                <Link
                  aria-current={item.selected ? "page" : undefined}
                  className={optionClass(item.selected)}
                  href={item.href}
                >
                  {item.label}
                </Link>
              </DropdownMenu.Item>
            ))
          ) : (
            <DropdownMenu.RadioGroup
              onValueChange={onValueChange}
              value={String(value)}
            >
              {visibleItems.map((item) => {
                const selected = String(item.value) === String(value);

                return (
                  <DropdownMenu.RadioItem
                    className={optionClass(selected)}
                    key={item.value}
                    value={String(item.value)}
                  >
                    <span>{item.label}</span>
                    <DropdownMenu.ItemIndicator aria-hidden="true">
                      ✓
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                );
              })}
            </DropdownMenu.RadioGroup>
          )}
          {visibleItems.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              {noMatchesLabel}
            </p>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
