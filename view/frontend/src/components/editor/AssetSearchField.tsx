import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

export function AssetSearchField({
  value,
  onChange,
  className,
  inputClassName,
  placeholder = "Search by name…",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("asset-search", className)}>
      <Search className="asset-search__icon h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        className={cn("asset-search__input", inputClassName)}
      />
    </div>
  );
}
