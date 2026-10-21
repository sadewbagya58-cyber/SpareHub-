import React from "react";
import Link from "next/link";
import { Wrench, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 sm:px-6 py-12">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-sparehub-light text-sparehub-orange flex items-center justify-center mx-auto border border-sparehub-border">
          <Wrench className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-sparehub-orange uppercase tracking-wider">
            404 Error
          </span>
          <h1 className="text-2xl font-black text-sparehub-dark tracking-tight">
            Part or Page Not Found
          </h1>
          <p className="text-xs text-gray-500 leading-relaxed">
            The page or catalog item you are looking for may have been moved, delisted, or does not exist.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center font-bold text-sm rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover shadow-sm px-4 py-2 gap-2 h-10 transition-all active:scale-[0.97]"
          >
            <Home className="w-4 h-4" />
            Return to Homepage
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-sm px-4 py-2 h-10 transition-all active:scale-[0.97]"
          >
            Browse All Parts
          </Link>
        </div>
      </div>
    </div>
  );
}
