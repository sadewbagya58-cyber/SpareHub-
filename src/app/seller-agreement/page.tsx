import { PolicyPageView } from "@/components/policies/policy-page-view";

export const metadata = {
  title: "Vendor Merchant Agreement | SpareHub Sri Lanka",
  description: "Commercial operating agreement governing vendor shops, commission calculations (1% to 5%), monthly billing, and overdue compliance.",
};

export default function SellerAgreementPage() {
  return <PolicyPageView policyType="seller_agreement" fallbackTitle="SpareHub Vendor Merchant Agreement" />;
}
