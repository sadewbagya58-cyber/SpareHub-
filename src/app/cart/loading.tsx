import React from "react";

export default function CartLoading() {
  return (
    <div
      role="status"
      aria-label="Loading shopping cart"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 animate-pulse"
    >
      <div className="h-16 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 h-72 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
        <div className="lg:col-span-4 h-64 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
      </div>
    </div>
  );
}
