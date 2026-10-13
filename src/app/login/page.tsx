"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Wrench, ArrowLeft, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setMessage(
        "Authentication backend will be connected in Phase 3 with Supabase Auth & Role-Based Access Control."
      );
    }, 400);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        <div className="p-8 rounded-2xl border border-sparehub-border bg-white shadow-md space-y-6">
          {/* Logo Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-sparehub-orange flex items-center justify-center text-white mx-auto shadow-sm">
              <Wrench className="w-6 h-6 -rotate-45" />
            </div>
            <h1 className="text-2xl font-black text-sparehub-dark tracking-tight">
              Sign In to SpareHub
            </h1>
            <p className="text-xs text-gray-500">
              Access your customer orders, vendor dashboard, or admin center
            </p>
          </div>

          {message && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 leading-relaxed">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              loadingText="Signing In..."
              className="w-full font-bold shadow-sm"
            >
              Sign In
            </Button>
          </form>

          <div className="pt-4 border-t border-sparehub-border text-center text-xs text-gray-500 space-y-2">
            <p>
              Want to open a vendor shop?{" "}
              <Link href="/sell" className="text-sparehub-orange font-bold hover:underline">
                Register as a Seller
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
