"use client";

import React, { useState, useTransition } from "react";
import { User, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfileAction, type AuthActionResult } from "@/lib/auth/actions";

interface ProfileFormProps {
  initialFullName: string;
  initialPhone: string;
}

export function ProfileForm({ initialFullName, initialPhone }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthActionResult | null>(null);

  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);

    const formData = new FormData();
    formData.append("fullName", fullName);
    formData.append("phone", phone);

    startTransition(async () => {
      const res = await updateProfileAction(null, formData);
      setResult(res);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {result?.error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-sparehub-error flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}

      {result?.success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-sparehub-success flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{result.message}</span>
        </div>
      )}

      <Input
        label="Full Name"
        type="text"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        leftIcon={<User className="w-4 h-4" />}
        disabled={isPending}
      />

      <Input
        label="Phone Number"
        type="tel"
        placeholder="0771234567"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        helperText="Used for delivery coordination and order notifications"
        leftIcon={<Phone className="w-4 h-4" />}
        disabled={isPending}
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
        isLoading={isPending}
        loadingText="Saving Changes..."
        className="font-bold"
      >
        Update Profile
      </Button>
    </form>
  );
}
