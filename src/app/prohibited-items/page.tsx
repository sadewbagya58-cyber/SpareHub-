import { PolicyPageView } from "@/components/policies/policy-page-view";

export const metadata = {
  title: "Prohibited Products & Conduct | SpareHub Sri Lanka",
  description: "Strict rules banning counterfeit parts, fake reviews, commission evasion, and safety-compromised automotive components.",
};

export default function ProhibitedProductsPage() {
  return <PolicyPageView policyType="prohibited_products_conduct" fallbackTitle="Prohibited Products & Seller Conduct Policy" />;
}
