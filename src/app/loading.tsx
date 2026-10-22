import React from "react";

export default function RootLoading() {
  return (
    <div
      role="status"
      aria-label="Loading page content"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 animate-pulse"
    >
      <div className="h-24 sm:h-28 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-gray-100 border border-sparehub-border/60"
          />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
    </div>
  );
}
