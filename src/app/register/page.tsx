"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench, ArrowLeft, Lock, Mail, User, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerAction, type AuthActionResult } from "@/lib/auth/actions";
import { refreshUserNavContext } from "@/lib/client/user-nav-store";

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthActionResult | null>(null);

  // Controlled form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setClientError(null);
    setResult(null);

    // Client-side quick validations
    if (password !== confirmPassword) {
      setClientError("Passwords do not match. Please verify.");
      return;
    }

    if (password.length < 8) {
      setClientError("Password must be at least 8 characters long.");
      return;
    }

    const formData = new FormData();
    formData.append("fullName", fullName);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);

    startTransition(async () => {
      const res = await registerAction(null, formData);
      setResult(res);

      if (res.success && !res.requiresEmailVerification) {
        void refreshUserNavContext(true);
        // Redirect after brief delay
        setTimeout(() => {
          router.push("/account");
        }, 600);
      }
    });
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        <div className="p-8 rounded-2xl border border-sparehub-border bg-white shadow-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-sparehub-orange flex items-center justify-center text-white mx-auto shadow-sm">
              <Wrench className="w-6 h-6 -rotate-45" />
            </div>
            <h1 className="text-2xl font-black text-sparehub-dark tracking-tight">
              Create an Account
            </h1>
            <p className="text-xs text-gray-500">
              Join SpareHub to find parts, track orders, and connect with trusted vendors
            </p>
          </div>

          {/* Result & Error Feedback */}
          {clientError && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-sparehub-error flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{clientError}</span>
            </div>
          )}

          {result?.error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-sparehub-error flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{result.error}</span>
            </div>
          )}

          {result?.success && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-sparehub-success">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Account Created!</span>
              </div>
              <p className="leading-relaxed">{result.message}</p>
              {!result.requiresEmailVerification ? (
                <p className="font-semibold text-gray-600">Redirecting to your account dashboard...</p>
              ) : (
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="w-full inline-flex items-center justify-center font-bold text-xs rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover shadow-sm px-3 py-1.5 h-8 transition-all active:scale-[0.97]"
                  >
                    Proceed to Sign In
                  </Link>
                </div>
              )}
            </div>
          )}

          {!result?.success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                placeholder="Kasun Perera"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                disabled={isPending}
              />

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
                label="Phone Number (Optional)"
                type="tel"
                placeholder="0771234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                helperText="Used for courier delivery and SMS order updates"
                leftIcon={<Phone className="w-4 h-4" />}
                disabled={isPending}
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText="Must be 8+ characters with uppercase, lowercase, and number"
                leftIcon={<Lock className="w-4 h-4" />}
                disabled={isPending}
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                disabled={isPending}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isPending}
                loadingText="Creating Account..."
                className="w-full font-bold shadow-sm mt-2"
              >
                Register as Customer
              </Button>
            </form>
          )}

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-sparehub-border text-center text-xs text-gray-500 space-y-2">
            <p>
              Already have an account?{" "}
              <Link href="/login" className="text-sparehub-orange font-bold hover:underline">
                Sign In
              </Link>
            </p>
            <p className="pt-1">
              Want to sell spare parts?{" "}
              <Link href="/sell" className="text-sparehub-dark font-semibold hover:text-sparehub-orange">
                Open a Vendor Shop &rarr;
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
