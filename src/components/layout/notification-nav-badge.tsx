"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import {
  getUserNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from "@/lib/notifications/actions";
import {
  useUserNavContext,
  updateUserNavState,
  refreshUserNavContext,
} from "@/lib/client/user-nav-store";
import type { NotificationItem } from "@/lib/types";

export function NotificationNavBadge() {
  const { authenticated, unreadNotificationCount: unreadCount } = useUserNavContext();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownOpenRef = useRef(false);

  useEffect(() => {
    dropdownOpenRef.current = dropdownOpen;
  }, [dropdownOpen]);

  const loadDropdownNotifications = useCallback(async () => {
    if (!authenticated) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const res = await getUserNotificationsAction({ limit: 5 });
      setNotifications(res.notifications);
      updateUserNavState({ unreadNotificationCount: res.unreadCount });
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    const handleUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ unreadCount?: number }>;
      if (typeof customEvent.detail?.unreadCount === "number") {
        updateUserNavState({ unreadNotificationCount: customEvent.detail.unreadCount });
      } else {
        void refreshUserNavContext(true);
      }
      if (dropdownOpenRef.current) {
        void loadDropdownNotifications();
      }
    };

    window.addEventListener("sparehub:notifications-updated", handleUpdated);

    // Non-blocking background sync via GET /api/user-context only when logged in and tab is visible
    const interval = setInterval(() => {
      if (authenticated && document.visibilityState === "visible") {
        void refreshUserNavContext(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener("sparehub:notifications-updated", handleUpdated);
      clearInterval(interval);
    };
  }, [authenticated, loadDropdownNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    const nextOpen = !dropdownOpen;
    setDropdownOpen(nextOpen);
    if (nextOpen) {
      void loadDropdownNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    // Immediate optimistic UI update (<16ms)
    const prevNotifications = notifications;
    const prevUnread = unreadCount;
    updateUserNavState({ unreadNotificationCount: 0 });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    const res = await markAllNotificationsAsReadAction();
    if (!res.success) {
      updateUserNavState({ unreadNotificationCount: prevUnread });
      setNotifications(prevNotifications);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    setDropdownOpen(false);
    if (!notif.read) {
      // Immediate optimistic UI update (<16ms)
      const nextCount = Math.max(0, unreadCount - 1);
      updateUserNavState({ unreadNotificationCount: nextCount });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      await markNotificationAsReadAction(notif.id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={dropdownOpen}
        className="relative p-1.5 sm:p-2 rounded-lg text-sparehub-dark hover:bg-sparehub-light transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-sparehub-orange text-white text-[9px] sm:text-[10px] font-bold rounded-full h-3.5 min-w-[14px] sm:h-4 sm:min-w-[16px] px-0.5 sm:px-1 flex items-center justify-center animate-in zoom-in-75">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div className="fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-96 rounded-xl border border-sparehub-border bg-white shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3 bg-gray-50 border-b border-sparehub-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-sparehub-dark">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-sparehub-orange/10 text-sparehub-orange text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-gray-500 hover:text-sparehub-orange flex items-center gap-1 font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-gray-500 animate-pulse">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-600">No notifications yet</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  We will notify you about your order updates here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const inner = (
                  <div
                    className={`p-3 transition-colors hover:bg-gray-50 cursor-pointer flex gap-3 items-start ${
                      !notif.read ? "bg-amber-50/40" : ""
                    }`}
                    onClick={() => handleItemClick(notif)}
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        !notif.read ? "bg-sparehub-orange" : "bg-transparent"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-sparehub-dark truncate">
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5">
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-gray-400 mt-1 inline-block">
                        {new Date(notif.createdAt).toLocaleDateString("en-LK", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );

                return notif.link ? (
                  <Link key={notif.id} href={notif.link} className="block">
                    {inner}
                  </Link>
                ) : (
                  <div key={notif.id}>{inner}</div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-gray-50 border-t border-sparehub-border text-center">
            <Link
              href="/account/notifications"
              onClick={() => setDropdownOpen(false)}
              className="text-xs font-semibold text-sparehub-orange hover:underline inline-flex items-center gap-1"
            >
              View all notifications
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
