import { PolicyPageView } from "@/components/policies/policy-page-view";

export const metadata = {
  title: "Terms and Conditions | SpareHub Sri Lanka",
  description: "Governing terms and conditions for buyers and vendors on the SpareHub automotive spare parts marketplace.",
};

export default function TermsPage() {
  return <PolicyPageView policyType="terms_and_conditions" fallbackTitle="Marketplace Terms & Conditions" />;
}
