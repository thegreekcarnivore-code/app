import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const VAPID_PUBLIC_KEY = "BJ9RN-MonAoC0p3JdyH_V-XIbbd4fWUmV0UplSUMgZe1FKHB-E41Ii-x04sao77qoeHHLof033KAJPCeqIi-usc";

// Stale endpoint patterns that should trigger a forced re-subscribe
const STALE_ENDPOINT_PATTERNS = [
  "fcm.googleapis.com/fcm/send/",
];

const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isStaleEndpoint(endpoint: string): boolean {
  return STALE_ENDPOINT_PATTERNS.some((p) => endpoint.includes(p));
}

function shouldRefresh(): boolean {
  const lastRefresh = localStorage.getItem("push_sub_refreshed_at");
  if (!lastRefresh) return true;
  return Date.now() - Number(lastRefresh) > REFRESH_INTERVAL_MS;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check existing subscription and refresh if stale
  useEffect(() => {
    if (!isSupported || !user) return;

    navigator.serviceWorker.ready.then(async (reg: any) => {
      const sub = await reg.pushManager?.getSubscription();
      if (sub) {
        // Force re-subscribe if endpoint is deprecated or subscription is old
        if (isStaleEndpoint(sub.endpoint) || shouldRefresh()) {
          console.log("[Push] Refreshing stale subscription");
          await sub.unsubscribe();
          setIsSubscribed(false);
          // Will be picked up by auto-subscribe in AppLayout
        } else {
          setIsSubscribed(true);
        }
      } else {
        setIsSubscribed(false);
      }
    });
  }, [isSupported, user]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user || !VAPID_PUBLIC_KEY) return false;
    setLoading(true);

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLoading(false);
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js") as any;
      await navigator.serviceWorker.ready;

      // Unsubscribe any existing subscription first to get a fresh one
      const existing = await registration.pushManager?.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = subscription.toJSON();

      // Store in database
      const { error } = await supabase
        .from("push_subscriptions" as any)
        .upsert({
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }, { onConflict: "user_id,endpoint" });

      if (error) throw error;

      // Mark refresh timestamp
      localStorage.setItem("push_sub_refreshed_at", String(Date.now()));

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Push subscription error:", err);
      setLoading(false);
      return false;
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !user) return;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready as any;
      const subscription = await registration.pushManager?.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from("push_subscriptions" as any)
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", endpoint);
      }

      localStorage.removeItem("push_sub_refreshed_at");
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
    setLoading(false);
  }, [isSupported, user]);

  return { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe };
}
