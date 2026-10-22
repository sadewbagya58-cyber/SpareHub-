import React from "react";

export default function AccountLoading() {
  return (
    <div
      role="status"
      aria-label="Loading customer account"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 animate-pulse"
    >
      <div className="h-24 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
        <div className="h-72 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
      </div>
    </div>
  );
}
