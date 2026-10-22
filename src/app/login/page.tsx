"use client";

import React, { useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Wrench, ArrowLeft, Lock, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, type AuthActionResult } from "@/lib/auth/actions";
import { safeRedirectUrl } from "@/lib/validators/auth";
import { refreshUserNavContext } from "@/lib/client/user-nav-store";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect");
  const targetRedirect = safeRedirectUrl(rawRedirect, "/account");

  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AuthActionResult | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting || isPending) return;
    setResult(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    if (rawRedirect) {
      formData.append("redirect", targetRedirect);
    }

    startTransition(async () => {
      try {
        const res = await loginAction(null, formData);
        setResult(res);

        if (res.success && res.redirectTo) {
          void refreshUserNavContext(true);
          router.push(res.redirectTo);
        } else {
          setIsSubmitting(false);
        }
      } catch {
        setIsSubmitting(false);
      }
    });
  };

  return (
    <div className="p-8 rounded-2xl border border-sparehub-border bg-white shadow-md space-y-6">
      {/* Header */}
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

      {result?.error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-sparehub-error flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{result.error}</span>
        </div>
      )}

      {result?.success && (
        <div className="p-3.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-sparehub-success shrink-0" />
          <span>Signed in successfully! Redirecting...</span>
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
          disabled={isPending}
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          disabled={isPending}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting || isPending}
          loadingText="Signing In..."
          className="w-full font-bold shadow-sm"
        >
          Sign In
        </Button>
      </form>

      {/* Footer Navigation */}
      <div className="pt-4 border-t border-sparehub-border text-center text-xs text-gray-500 space-y-2">
        <p>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-sparehub-orange font-bold hover:underline">
            Register as Customer
          </Link>
        </p>
        <p className="pt-1">
          Want to open a vendor shop?{" "}
          <Link href="/sell" className="text-sparehub-dark font-semibold hover:text-sparehub-orange">
            Register as a Seller &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
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

        <Suspense fallback={<div className="p-8 bg-white rounded-2xl shadow-sm text-center text-sm text-gray-400">Loading sign in form...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
