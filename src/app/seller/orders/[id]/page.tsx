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
  const { id } = await params;
  const [authData, subOrder] = await Promise.all([
    getCurrentUserProfile(),
    getSellerOrderDetailAction(id),
  ]);

  if (!authData || !authData.user) {
    redirect(`/login?redirect=/seller/orders/${id}`);
  }

  if (!subOrder) {
    notFound();
  }

  return <SellerOrderFulfillment subOrder={subOrder} />;
}
