
/* ==========================================
   BESTIE UNIVERSITY 🎓💗
   PHASE 2 — CAMPUS NOTIFICATIONS
   ========================================== */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const config = window.BB_CONFIG;

  if (
    !window.supabase ||
    !config?.SUPABASE_URL ||
    !config?.SUPABASE_ANON_KEY
  ) {
    console.error("Campus Notifications: Supabase unavailable.");
    return;
  }

  const client = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );

  const typeIcons = {
    general: "💌",
    announcement: "📣",
    activity: "🎮",
    honors: "💎",
    monthly_crown: "🏆"
  };

  function showStatus(text) {
    const element = $("dashboardNotices");
    if (element) element.textContent = text;
  }

  function createNotificationCard(notification) {
    const card = document.createElement("article");
    card.className = "campus-notification";

    const heading = document.createElement("strong");
    heading.textContent =
      `${typeIcons[notification.notification_type] || "💌"} ${notification.title}`;

    const description = document.createElement("p");
    description.textContent = notification.message;

    const date = document.createElement("small");
    date.textContent = new Date(
      notification.created_at
    ).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

    card.append(heading, description, date);

    if (!notification.is_read) {
      card.classList.add("unread");

      const markRead = document.createElement("button");
      markRead.type = "button";
      markRead.className = "notification-read-button";
      markRead.textContent = "Mark as Read ♡";

      markRead.addEventListener("click", async () => {
        markRead.disabled = true;

        const { error } = await client
          .from("campus_notifications")
          .update({ is_read: true })
          .eq("id", notification.id);

        if (error) {
          console.error("Mark notification read:", error);
          markRead.disabled = false;
          markRead.textContent = "Try Again ♡";
          return;
        }

        await loadNotifications();
      });

      card.appendChild(markRead);
    }

    return card;
  }

  async function loadNotifications() {
    const container = $("notificationList");

    if (!container) return;

    container.replaceChildren();
    showStatus("Checking your campus mail... 💌");

    try {
      const {
        data: { user },
        error: authError
      } = await client.auth.getUser();

      if (authError || !user) {
        showStatus("Sign in to view campus notices.");
        return;
      }

      const { data: profile, error: profileError } =
        await client
          .from("profiles")
          .select("membership_status")
          .eq("id", user.id)
          .maybeSingle();

      if (
        profileError ||
        profile?.membership_status !== "approved"
      ) {
        showStatus("Campus notices are for approved Besties.");
        return;
      }

      const { data, error } = await client
        .from("campus_notifications")
        .select(
          "id, title, message, notification_type, is_read, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const notifications = data || [];
      const unreadCount = notifications.filter(
        (notification) => !notification.is_read
      ).length;

      if (notifications.length === 0) {
        showStatus("No campus notices yet, Bestie! ♡");
        return;
      }

      showStatus(
        unreadCount > 0
          ? `💌 ${unreadCount} unread notice${unreadCount === 1 ? "" : "s"} in your latest 20!`
          : "All caught up on your latest campus notices! 💗"
      );

      notifications.forEach((notification) => {
        container.appendChild(
          createNotificationCard(notification)
        );
      });

    } catch (error) {
      console.error("Campus Notifications:", error);
      showStatus("Unable to load campus notices right now.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadNotifications();

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) loadNotifications();
    });
  });
})();
