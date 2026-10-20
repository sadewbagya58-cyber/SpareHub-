"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { NotificationItem } from "@/lib/types";

/**
 * Internal helper to create a persistent notification for a user.
 * Protected with idempotency key to prevent duplicate notifications.
 */
export async function createNotification(params: {
  userId: string;
  type:
    | "order_placed"
    | "order_confirmed"
    | "order_processing"
    | "order_dispatched"
    | "order_delivered"
    | "order_cancelled"
    | "order_rejected"
    | "system";
  title: string;
  message: string;
  link?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; id?: string }> {
  try {
    const admin = createAdminClient();

    if (params.idempotencyKey) {
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("idempotency_key", params.idempotencyKey)
        .maybeSingle();

      if (existing) {
        return { success: true, id: existing.id };
      }
    }

    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title.trim(),
        message: params.message.trim(),
        link: params.link?.trim() || null,
        idempotency_key: params.idempotencyKey || null,
        metadata: params.metadata || {},
        read: false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating notification:", error);
      return { success: false };
    }

    return { success: true, id: data.id };
  } catch (err) {
    console.error("Unexpected error in createNotification:", err);
    return { success: false };
  }
}

/**
 * Fetch authenticated user's notifications.
 */
export async function getUserNotificationsAction(options?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<{
  notifications: NotificationItem[];
  unreadCount: number;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { notifications: [], unreadCount: 0 };
  }

  const limit = Math.min(options?.limit || 30, 100);

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.unreadOnly) {
    query = query.eq("read", false);
  }

  const [{ data: list, error: listErr }, { count: unreadCount, error: countErr }] =
    await Promise.all([
      query,
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
    ]);

  if (listErr) {
    console.error("Error fetching notifications:", listErr);
    return { notifications: [], unreadCount: 0 };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: NotificationItem[] = (list || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    read: row.read,
    readAt: row.read_at,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));

  return {
    notifications: items,
    unreadCount: countErr ? 0 : unreadCount || 0,
  };
}

/**
 * Quick unread notification count lookup for navbar bell badge.
 */
export async function getUnreadNotificationCountAction(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error || typeof count !== "number") return 0;
  return count;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsReadAction(notificationId: string): Promise<{
  success: boolean;
  unreadCount?: number;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false };

  const { error } = await supabase
    .from("notifications")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false };
  }

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  revalidatePath("/account/notifications");
  return { success: true, unreadCount: count || 0 };
}

/**
 * Mark all unread notifications as read.
 */
export async function markAllNotificationsAsReadAction(): Promise<{
  success: boolean;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false };

  const { error } = await supabase
    .from("notifications")
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) {
    return { success: false };
  }

  revalidatePath("/account/notifications");
  return { success: true };
}

/**
 * Delete a notification.
 */
export async function deleteNotificationAction(notificationId: string): Promise<{
  success: boolean;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false };

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false };
  }

  revalidatePath("/account/notifications");
  return { success: true };
}
