import React from "react";

export default function CheckoutLoading() {
  return (
    <div
      role="status"
      aria-label="Loading secure checkout"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 animate-pulse"
    >
      <div className="h-16 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 h-80 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
        <div className="lg:col-span-5 h-72 rounded-2xl bg-gray-100 border border-sparehub-border/60" />
      </div>
    </div>
  );
}
