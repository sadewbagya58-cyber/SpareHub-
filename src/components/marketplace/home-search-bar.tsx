"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HomeSearchBarProps {
  initialQuery?: string;
  className?: string;
}

export function HomeSearchBar({
  initialQuery = "",
  className = "",
}: HomeSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    const trimmed = query.trim();
    const targetUrl = trimmed
      ? `/search?q=${encodeURIComponent(trimmed)}`
      : "/search";

    startTransition(() => {
      router.push(targetUrl);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Search spare parts catalog"
      className={`w-full ${className}`}
    >
      <label htmlFor="home-marketplace-search" className="sr-only">
        Search spare parts, brands or OEM codes
      </label>
      <div className="relative flex items-center w-full rounded-xl bg-white border-2 border-sparehub-border focus-within:border-sparehub-orange focus-within:ring-2 focus-within:ring-sparehub-orange/20 shadow-xs transition-all overflow-hidden">
        <div className="pl-3.5 sm:pl-4 pr-2 text-gray-400 shrink-0 pointer-events-none">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-sparehub-orange" />
        </div>

        <input
          id="home-marketplace-search"
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isPending}
          placeholder="Search spare parts, brands or OEM codes..."
          autoComplete="off"
          className="w-full py-2.5 sm:py-3 pr-2 text-sm sm:text-base text-sparehub-dark placeholder:text-gray-400 bg-transparent focus:outline-none disabled:opacity-60"
        />

        {query.length > 0 && !isPending && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search query"
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="p-1 sm:p-1.5 shrink-0">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isPending}
            loadingText="Searching..."
            disabled={isPending}
            className="h-9 sm:h-10 px-3.5 sm:px-5 rounded-lg font-bold text-xs sm:text-sm shadow-2xs"
          >
            Search
          </Button>
        </div>
      </div>
    </form>
  );
}
