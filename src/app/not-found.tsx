import React from "react";
import Link from "next/link";
import { Wrench, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

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
          <Link href="/">
            <Button variant="primary" size="md" className="font-bold gap-2">
              <Home className="w-4 h-4" />
              Return to Homepage
            </Button>
          </Link>
          <Link href="/search">
            <Button variant="outline" size="md">
              Browse All Parts
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
