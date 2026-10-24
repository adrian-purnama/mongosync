"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/src/components/ui/cn";
import { IconCheck, IconChevronDown, IconSearch } from "@/src/components/ui/icons";

type DropdownOption = {
  value: string;
  label: string;
};

type SearchableDropdownProps = {
  label: string;
  value: string;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: ReactNode;
  hideLabel?: boolean;
};

const triggerClass =
  "flex h-10 w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 text-left text-sm shadow-card transition hover:border-line-strong disabled:cursor-not-allowed disabled:bg-paper disabled:shadow-none";

const panelClass =
  "absolute z-30 mt-1.5 w-full min-w-56 animate-pop-in overflow-hidden rounded-xl border border-line bg-surface shadow-pop";

function useOutsideClose(onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onCloseRef.current();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return containerRef;
}

function useFilteredOptions(options: DropdownOption[], query: string) {
  return useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);
}

function SearchBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3">
      <IconSearch className="text-subtle" />
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Search ${label.toLowerCase()}`}
        className="h-10 w-full bg-transparent text-sm text-ink outline-none focus-visible:!outline-none placeholder:text-subtle"
      />
    </div>
  );
}

function Trigger({
  disabled,
  isOpen,
  onClick,
  icon,
  filled,
  children,
  label,
}: {
  disabled: boolean;
  isOpen: boolean;
  onClick: () => void;
  icon?: ReactNode;
  filled: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-label={label}
      className={cn(triggerClass, isOpen && "border-sync ring-4 ring-sync/12")}
    >
      {icon ? <span className="shrink-0 text-subtle">{icon}</span> : null}
      <span className={cn("min-w-0 flex-1 truncate", filled ? "text-ink" : "text-subtle")}>
        {children}
      </span>
      <IconChevronDown
        className={cn("shrink-0 text-subtle transition-transform", isOpen && "rotate-180")}
      />
    </button>
  );
}

export function SearchableDropdown({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  icon,
  hideLabel = false,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useOutsideClose(() => {
    setQuery("");
    setIsOpen(false);
  });

  const selectedOption = options.find((option) => option.value === value) ?? null;
  const filteredOptions = useFilteredOptions(options, query);

  return (
    <div className="grid gap-1.5">
      {hideLabel ? null : <span className="text-[13px] font-medium text-ink">{label}</span>}
      <div ref={containerRef} className="relative">
        <Trigger
          label={label}
          disabled={disabled}
          isOpen={isOpen}
          icon={icon}
          filled={Boolean(selectedOption)}
          onClick={() =>
            setIsOpen((current) => {
              const next = !current;

              if (!next) {
                setQuery("");
              }

              return next;
            })
          }
        >
          {selectedOption?.label ?? placeholder}
        </Trigger>

        {isOpen ? (
          <div className={panelClass}>
            <SearchBox label={label} value={query} onChange={setQuery} />
            <div role="listbox" className="scrollbar-thin max-h-64 overflow-auto p-1.5">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-[13px] text-subtle">
                  No results found.
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const selected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(option.value);
                        setQuery("");
                        setIsOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
                        selected ? "bg-sync-wash text-sync-strong" : "text-ink hover:bg-paper",
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {selected ? <IconCheck className="shrink-0" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type MultiSearchableDropdownProps = {
  label: string;
  values: string[];
  options: DropdownOption[];
  placeholder: string;
  onChange: (values: string[]) => void;
  disabled?: boolean;
  icon?: ReactNode;
};

export function MultiSearchableDropdown({
  label,
  values,
  options,
  placeholder,
  onChange,
  disabled = false,
  icon,
}: MultiSearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useOutsideClose(() => {
    setQuery("");
    setIsOpen(false);
  });
  const filteredOptions = useFilteredOptions(options, query);

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? options.find((option) => option.value === values[0])?.label ?? values[0]
        : `${values.length} collections selected`;

  function toggleValue(nextValue: string) {
    onChange(
      values.includes(nextValue)
        ? values.filter((value) => value !== nextValue)
        : [...values, nextValue],
    );
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <div ref={containerRef} className="relative">
        <Trigger
          label={label}
          disabled={disabled}
          isOpen={isOpen}
          icon={icon}
          filled={values.length > 0}
          onClick={() => setIsOpen((current) => !current)}
        >
          {summary}
        </Trigger>

        {isOpen ? (
          <div className={panelClass}>
            <SearchBox label={label} value={query} onChange={setQuery} />
            <div role="listbox" aria-multiselectable className="scrollbar-thin max-h-64 overflow-auto p-1.5">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-[13px] text-subtle">
                  No results found.
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const checked = values.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggleValue(option.value)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink transition hover:bg-paper"
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition",
                          checked ? "border-sync bg-sync text-white" : "border-line-strong bg-surface",
                        )}
                      >
                        {checked ? <IconCheck size={12} strokeWidth={3} /> : null}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
