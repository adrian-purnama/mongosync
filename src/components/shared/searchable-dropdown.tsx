"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
};

export function SearchableDropdown({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
}: SearchableDropdownProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = options.find((option) => option.value === value) ?? null;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setQuery("");
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      {label}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            setIsOpen((current) => {
              const next = !current;

              if (!next) {
                setQuery("");
              }

              return next;
            })
          }
          className="flex w-full items-center justify-between rounded-md border border-zinc-300 bg-white px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:bg-zinc-100"
        >
          <span className={selectedOption ? "text-zinc-950" : "text-zinc-400"}>
            {selectedOption?.label ?? placeholder}
          </span>
          <span className="text-zinc-400">{isOpen ? "▲" : "▼"}</span>
        </button>

        {isOpen ? (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-300 bg-white p-2 shadow-xl">
            <div className="border-b border-zinc-200 pb-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-2 max-h-64 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500">No results found.</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className="block w-full rounded-md border border-transparent px-3 py-2 text-left text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );
}

type MultiSearchableDropdownProps = {
  label: string;
  values: string[];
  options: DropdownOption[];
  placeholder: string;
  onChange: (values: string[]) => void;
  disabled?: boolean;
};

export function MultiSearchableDropdown({
  label,
  values,
  options,
  placeholder,
  onChange,
  disabled = false,
}: MultiSearchableDropdownProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setQuery("");
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? options.find((option) => option.value === values[0])?.label ?? values[0]
        : `${values.length} selected`;

  function toggleValue(nextValue: string) {
    onChange(
      values.includes(nextValue)
        ? values.filter((value) => value !== nextValue)
        : [...values, nextValue],
    );
  }

  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-700">
      {label}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          className="flex w-full items-center justify-between rounded-md border border-zinc-300 bg-white px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:bg-zinc-100"
        >
          <span className={values.length > 0 ? "text-zinc-950" : "text-zinc-400"}>
            {summary}
          </span>
          <span className="text-zinc-400">{isOpen ? "▲" : "▼"}</span>
        </button>

        {isOpen ? (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-300 bg-white p-2 shadow-xl">
            <div className="border-b border-zinc-200 pb-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-2 max-h-64 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500">No results found.</div>
              ) : (
                filteredOptions.map((option) => {
                  const checked = values.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(option.value)}
                      className="flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-left text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
                    >
                      <input type="checkbox" checked={checked} readOnly />
                      <span>{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );
}
