"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  XCircle,
  CheckCheck,
  Trash2,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  getUserNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
  deleteNotificationAction,
} from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "orders">("all");

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const res = await getUserNotificationsAction({ limit: 50 });
        if (!isMounted) return;
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      } catch {
        // fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await markNotificationAsReadAction(id);
    window.dispatchEvent(new CustomEvent("sparehub:notifications-updated"));
  };

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsAsReadAction();
      window.dispatchEvent(new CustomEvent("sparehub:notifications-updated"));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (target && !target.read) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotificationAction(id);
    window.dispatchEvent(new CustomEvent("sparehub:notifications-updated"));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "orders") return n.type.startsWith("order_");
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "order_placed":
        return <Package className="w-5 h-5 text-blue-600" />;
      case "order_confirmed":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "order_processing":
        return <Clock className="w-5 h-5 text-amber-600" />;
      case "order_dispatched":
        return <Truck className="w-5 h-5 text-indigo-600" />;
      case "order_delivered":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "order_cancelled":
      case "order_rejected":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Bell className="w-5 h-5 text-sparehub-orange" />;
    }
  };

  return (
    <div className="min-h-screen bg-sparehub-light py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-sparehub-orange">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/account" className="hover:text-sparehub-orange">
            My Account
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-sparehub-dark font-medium">Notifications</span>
        </nav>

        {/* Page Header */}
        <div className="bg-white rounded-2xl border border-sparehub-border p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-sparehub-dark flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-sparehub-orange" />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-sparehub-orange text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Real-time updates on your orders, deliveries, and marketplace announcements.
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              isLoading={markingAll}
              loadingText="Marking all read..."
              disabled={markingAll}
              onClick={handleMarkAllRead}
              className="gap-2 shrink-0 self-start sm:self-auto font-medium"
            >
              <CheckCheck className="w-4 h-4 text-sparehub-orange" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
              filter === "all"
                ? "bg-sparehub-dark text-white"
                : "bg-white text-gray-600 border border-sparehub-border hover:bg-gray-50"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
              filter === "unread"
                ? "bg-sparehub-dark text-white"
                : "bg-white text-gray-600 border border-sparehub-border hover:bg-gray-50"
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("orders")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
              filter === "orders"
                ? "bg-sparehub-dark text-white"
                : "bg-white text-gray-600 border border-sparehub-border hover:bg-gray-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Order Updates
          </button>
        </div>

        {/* Notification List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-sparehub-border p-12 text-center text-sm text-gray-500 animate-pulse">
            Loading your notification feed...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-sparehub-border p-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-sparehub-dark">No notifications found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {filter === "unread"
                ? "You're all caught up! There are no unread notifications right now."
                : "You don't have any notifications in this section yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`bg-white rounded-xl border p-4 sm:p-5 transition-all shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                  !notif.read
                    ? "border-amber-200 bg-amber-50/20"
                    : "border-sparehub-border hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-sparehub-dark truncate">
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-sparehub-orange shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[11px] text-gray-400 mt-2 inline-block">
                      {new Date(notif.createdAt).toLocaleDateString("en-LK", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {notif.link && (
                    <Link
                      href={notif.link}
                      onClick={() => {
                        if (!notif.read) handleMarkAsRead(notif.id);
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light px-3 h-8 gap-1.5 text-xs font-semibold transition-all active:scale-[0.97]"
                    >
                      View
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {!notif.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkAsRead(notif.id)}
                      title="Mark as read"
                      className="h-8 px-2 text-xs text-gray-500 hover:text-sparehub-dark"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(notif.id)}
                    title="Delete notification"
                    className="h-8 px-2 text-xs text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
