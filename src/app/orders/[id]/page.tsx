import React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getCustomerOrderDetailAction } from "@/lib/orders/actions";
import { OrderDetailView } from "./order-detail-view";

export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrderDetailPageProps) {
  const { id } = await params;
  return {
    title: `Order Details | SpareHub`,
    description: `Track status and vendor dispatch updates for order ${id}.`,
  };
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const [authData, order] = await Promise.all([
    getCurrentUserProfile(),
    getCustomerOrderDetailAction(id),
  ]);

  if (!authData || !authData.user) {
    redirect(`/login?redirect=/orders/${id}`);
  }

  if (!order) {
    notFound();
  }

  return <OrderDetailView order={order} />;
}
