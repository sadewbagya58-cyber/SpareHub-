import { PolicyPageView } from "@/components/policies/policy-page-view";

export const metadata = {
  title: "Warranty Policy | SpareHub Sri Lanka",
  description: "Warranty disclosure standards for genuine, aftermarket, reconditioned, and electrical automotive spare parts.",
};

export default function WarrantyPolicyPage() {
  return <PolicyPageView policyType="warranty_policy" fallbackTitle="Automotive Spare Parts Warranty Policy" />;
}
