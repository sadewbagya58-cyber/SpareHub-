import { PolicyPageView } from "@/components/policies/policy-page-view";

export const metadata = {
  title: "Returns and Refunds Policy | SpareHub Sri Lanka",
  description: "Comprehensive return eligibility, return shipping guidelines, and refund workflow for automotive spare parts.",
};

export default function ReturnsPolicyPage() {
  return <PolicyPageView policyType="returns_and_refunds" fallbackTitle="Return, Replacement and Refund Policy" />;
}
