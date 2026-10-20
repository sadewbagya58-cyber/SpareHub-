"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import {
  getUserNotificationsAction,
  getUnreadNotificationCountAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/types";

export function NotificationNavBadge() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadDropdownNotifications = async () => {
    setLoading(true);
    try {
      const res = await getUserNotificationsAction({ limit: 5 });
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchCount() {
      try {
        const count = await getUnreadNotificationCountAction();
        if (isMounted) setUnreadCount(count);
      } catch {
        // silent fallback
      }
    }

    fetchCount();

    const handleUpdated = () => {
      fetchCount();
      if (dropdownOpen) {
        loadDropdownNotifications();
      }
    };

    window.addEventListener("sparehub:notifications-updated", handleUpdated);
    const interval = setInterval(fetchCount, 30000); // 30s background sync

    return () => {
      isMounted = false;
      window.removeEventListener("sparehub:notifications-updated", handleUpdated);
      clearInterval(interval);
    };
  }, [dropdownOpen]);

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
    if (!dropdownOpen) {
      loadDropdownNotifications();
    }
    setDropdownOpen(!dropdownOpen);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsReadAction();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      await markNotificationAsReadAction(notif.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    setDropdownOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={dropdownOpen}
        className="relative p-2 rounded-lg text-sparehub-dark hover:bg-sparehub-light transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-sparehub-orange text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center animate-in zoom-in-75">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-sparehub-border bg-white shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
