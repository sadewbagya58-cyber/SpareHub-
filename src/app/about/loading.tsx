import React from "react";

export default function AboutLoading() {
  return (
    <div className="min-h-screen bg-sparehub-light/40 pb-16 animate-pulse">
      <div className="bg-sparehub-dark py-8 sm:py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-3">
          <div className="h-5 w-44 rounded-full bg-gray-800" />
          <div className="h-8 sm:h-10 w-72 sm:w-96 rounded-lg bg-gray-800" />
          <div className="h-4 w-full max-w-xl rounded bg-gray-800" />
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white border border-sparehub-border p-5"
            />
          ))}
        </div>
        <div className="h-44 rounded-xl bg-white border border-sparehub-border p-5" />
      </div>
    </div>
  );
}
