"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

export interface UserNavProfile {
  role: string;
  roles: string[];
  full_name: string;
}

export interface UserNavIdentity {
  id: string;
  email: string;
}

export interface UserNavState {
  initialized: boolean;
  authenticated: boolean;
  user: UserNavIdentity | null;
  profile: UserNavProfile | null;
  hasSellerProfile: boolean;
  cartCount: number;
  unreadNotificationCount: number;
}

const DEFAULT_ANONYMOUS_STATE: UserNavState = {
  initialized: true,
  authenticated: false,
  user: null,
  profile: null,
  hasSellerProfile: false,
  cartCount: 0,
  unreadNotificationCount: 0,
};

let currentState: UserNavState = {
  ...DEFAULT_ANONYMOUS_STATE,
  initialized: false,
};

let lastFetchedAt = 0;
let inflightPromise: Promise<UserNavState> | null = null;
let listenersBound = false;
const subscribers = new Set<(state: UserNavState) => void>();

function notifySubscribers() {
  for (const listener of subscribers) {
    listener(currentState);
  }
}

export function updateUserNavState(partial: Partial<UserNavState>) {
  currentState = {
    ...currentState,
    ...partial,
    initialized: true,
  };
  notifySubscribers();
}

/**
 * Checks whether the browser currently holds any Supabase auth cookie (`sb-*`).
 * When false, the user is guaranteed anonymous and we can resolve in 0ms without network I/O.
 */
function hasBrowserAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  const raw = document.cookie || "";
  return raw.split(";").some((part) => part.trim().startsWith("sb-"));
}

export async function refreshUserNavContext(force = false): Promise<UserNavState> {
  if (typeof window === "undefined") {
    return currentState;
  }

  // Fast-path: if there is no `sb-*` cookie in the browser, resolve anonymous state in 0ms
  if (!hasBrowserAuthCookie() && !force) {
    if (!currentState.initialized || currentState.authenticated) {
      currentState = { ...DEFAULT_ANONYMOUS_STATE };
      lastFetchedAt = Date.now();
      notifySubscribers();
    }
    return currentState;
  }

  const now = Date.now();
  if (!force && currentState.initialized && now - lastFetchedAt < 10_000) {
    return currentState;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const response = await fetch("/api/user-context", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      currentState = {
        initialized: true,
        authenticated: Boolean(data.authenticated && data.user),
        user: data.user ?? null,
        profile: data.profile ?? null,
        hasSellerProfile: Boolean(data.hasSellerProfile),
        cartCount: Number(data.cartCount) || 0,
        unreadNotificationCount: Number(data.unreadNotificationCount) || 0,
      };
      lastFetchedAt = Date.now();
      notifySubscribers();
      return currentState;
    } catch {
      if (!currentState.initialized) {
        currentState = { ...DEFAULT_ANONYMOUS_STATE };
        notifySubscribers();
      }
      return currentState;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

function ensureGlobalListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  try {
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event, session) => {
      // Ignore INITIAL_SESSION to prevent duplicate mount-time fetches
      if (event === "INITIAL_SESSION") return;

      if (event === "SIGNED_OUT" || !session?.user) {
        currentState = { ...DEFAULT_ANONYMOUS_STATE };
        lastFetchedAt = Date.now();
        notifySubscribers();
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        void refreshUserNavContext(true);
      }
    });
  } catch {
    // Ignore if env vars missing in isolated unit tests
  }
}

const SERVER_SNAPSHOT: UserNavState = {
  ...DEFAULT_ANONYMOUS_STATE,
  initialized: false,
};

function subscribeStore(listener: () => void) {
  const wrapped = () => listener();
  subscribers.add(wrapped);
  return () => {
    subscribers.delete(wrapped);
  };
}

function getClientSnapshot(): UserNavState {
  if (!currentState.initialized && !hasBrowserAuthCookie()) {
    currentState = { ...DEFAULT_ANONYMOUS_STATE };
    lastFetchedAt = Date.now();
  }
  return currentState;
}

function getServerSnapshot(): UserNavState {
  return SERVER_SNAPSHOT;
}

export function useUserNavContext(): UserNavState {
  const state = useSyncExternalStore(
    subscribeStore,
    getClientSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    ensureGlobalListeners();
    if (!currentState.initialized) {
      void refreshUserNavContext(false);
    }
  }, []);

  return state;
}
