import { PolicyPageView } from "@/components/policies/policy-page-view";

export const metadata = {
  title: "Privacy Policy | SpareHub Sri Lanka",
  description: "Learn how SpareHub protects your personal data and verification documents in accordance with Sri Lankan PDPA principles.",
};

export default function PrivacyPage() {
  return <PolicyPageView policyType="privacy_policy" fallbackTitle="Marketplace Privacy Policy" />;
}
