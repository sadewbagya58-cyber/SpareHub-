import React from "react";

export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-label="Loading admin portal"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 animate-pulse"
    >
      <div className="h-24 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-gray-100 border border-sparehub-border/60"
          />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
    </div>
  );
}
