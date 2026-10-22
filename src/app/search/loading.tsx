import React from "react";

export default function SearchLoading() {
  return (
    <div
      role="status"
      aria-label="Loading marketplace catalog"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-pulse"
    >
      <div className="h-20 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="h-72 rounded-2xl bg-gray-100 border border-sparehub-border/60"
          />
        ))}
      </div>
    </div>
  );
}
