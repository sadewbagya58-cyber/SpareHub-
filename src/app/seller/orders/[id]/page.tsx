import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getSellerOrderDetailAction } from "@/lib/orders/actions";
import { SellerOrderFulfillment } from "./seller-order-fulfillment";

export const dynamic = "force-dynamic";

interface SellerOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SellerOrderDetailPageProps) {
  const { id } = await params;
  return {
    title: `Fulfill Sub-Order | SpareHub`,
    description: `Process and dispatch sub-order ${id}.`,
  };
}

export default async function SellerOrderDetailPage({ params }: SellerOrderDetailPageProps) {
  const authData = await getCurrentUserProfile();
  if (!authData || !authData.user) {
    const { id } = await params;
    redirect(`/login?redirect=/seller/orders/${id}`);
  }

  const { id } = await params;
  const subOrder = await getSellerOrderDetailAction(id);

  if (!subOrder) {
    notFound();
  }

  return <SellerOrderFulfillment subOrder={subOrder} />;
}
