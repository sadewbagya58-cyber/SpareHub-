import React from "react";
import Link from "next/link";
import { Shield, Clock, ArrowLeft, FileText, AlertTriangle } from "lucide-react";
import { getPublishedPolicyAction } from "@/lib/policies/actions";

interface PolicyPageViewProps {
  policyType: string;
  fallbackTitle: string;
}

export async function PolicyPageView({ policyType, fallbackTitle }: PolicyPageViewProps) {
  const res = await getPublishedPolicyAction(policyType);
  const policy = res.policy;

  return (
    <div className="min-h-screen bg-sparehub-light py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>

        {/* Document Card */}
        <div className="bg-white rounded-2xl border border-sparehub-border p-6 sm:p-10 shadow-xs space-y-6">
          <div className="border-b border-gray-100 pb-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-orange-50 text-sparehub-orange">
                <FileText className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                SpareHub Marketplace Policy
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
              {policy?.title || fallbackTitle}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                Version {policy?.version || "1.0"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Effective: {policy?.effectiveDate || "October 2026"}
              </span>
            </div>
          </div>

          {/* Legal Notice Callout */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block text-amber-950 font-bold">
                Sri Lankan Commercial Policy Notice &amp; Legal Review
              </strong>
              <p className="text-amber-800 leading-relaxed text-[11px]">
                This policy is published for the SpareHub automotive spare parts marketplace under Sri Lankan commercial
                and consumer trade conventions. It is a commercial operating draft subject to periodic review by
                qualified legal counsel in Sri Lanka.
              </p>
            </div>
          </div>

          {/* Markdown Content Viewer */}
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-4">
            {policy?.contentMarkdown ? (
              <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-gray-700 leading-relaxed">
                {policy.contentMarkdown}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Policy content is currently being updated.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
