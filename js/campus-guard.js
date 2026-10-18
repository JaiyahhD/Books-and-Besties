
/* ============================================
   BESTIE UNIVERSITY 🎓
   CAMPUS ACCESS GUARD
   js/campus-guard.js

   Reusable Supabase membership verification.

   Access levels:
   - approved: All approved Besties
   - honors: Active Honors Society members
   - staff: Campus admins and moderators
   - admin: Campus admins only

   IMPORTANT:
   This controls page visibility and navigation.
   Supabase RLS must separately protect data.
============================================ */

(() => {
  "use strict";

  const VALID_LEVELS = [
    "approved",
    "honors",
    "staff",
    "admin"
  ];

  let client = null;

  function getClient() {
    if (client) return client;

    const config = window.BB_CONFIG;

    if (
      !window.supabase ||
      !config?.SUPABASE_URL ||
      !config?.SUPABASE_ANON_KEY
    ) {
      throw new Error(
        "Campus authentication is unavailable."
      );
    }

    client = window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    );

    return client;
  }

  async function checkAccess(level = "approved") {
    if (!VALID_LEVELS.includes(level)) {
      throw new Error(
        "Invalid campus access level."
      );
    }

    const supabaseClient = getClient();

    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return {
        allowed: false,
        reason: "signed_out",
        user: null,
        profile: null,
        client: supabaseClient
      };
    }

    const {
      data: profile,
      error: profileError
    } = await supabaseClient
      .from("profiles")
      .select(
        "id, display_name, membership_status"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (
      !profile ||
      profile.membership_status !== "approved"
    ) {
      return {
        allowed: false,
        reason: "not_approved",
        user,
        profile,
        client: supabaseClient
      };
    }

    if (level === "approved") {
      return {
        allowed: true,
        reason: "approved",
        user,
        profile,
        client: supabaseClient
      };
    }

    if (level === "honors") {
      const {
        data: honors,
        error: honorsError
      } = await supabaseClient
        .from("honors_memberships")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (honorsError) throw honorsError;

      return {
        allowed: honors?.status === "active",
        reason: honors?.status === "active"
          ? "honors"
          : "honors_required",
        user,
        profile,
        client: supabaseClient
      };
    }

    const {
      data: staff,
      error: staffError
    } = await supabaseClient
      .from("campus_staff")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (staffError) throw staffError;

    const allowed = level === "admin"
      ? staff?.role === "admin"
      : ["admin", "moderator"].includes(
          staff?.role
        );

    return {
      allowed,
      reason: allowed
        ? "staff"
        : "staff_required",
      user,
      profile,
      staff,
      client: supabaseClient
    };
  }

  function showDeniedMessage(reason) {
    const messages = {
      signed_out:
        "🎓 Please sign in to enter this campus space.",

      not_approved:
        "💌 Your campus membership must be approved before you can enter.",

      honors_required:
        "💎 This lounge is reserved for active Honors Society Besties.",

      staff_required:
        "🗝️ This campus office is reserved for authorized staff."
    };

    return messages[reason] ||
      "This campus space is currently unavailable.";
  }

  async function protectPage(options = {}) {
    const {
      level = "approved",
      gateId = "campusGate",
      contentId = "campusContent",
      messageId = "campusGateMessage"
    } = options;

    const gate = document.getElementById(gateId);
    const content = document.getElementById(contentId);
    const message = document.getElementById(messageId);

    // Always hide protected content while checking.
    if (content) content.hidden = true;
    if (gate) gate.hidden = false;

    try {
      const result = await checkAccess(level);

      if (!result.allowed) {
        if (message) {
          message.textContent =
            showDeniedMessage(result.reason);
        }

        return result;
      }

      if (gate) gate.hidden = true;
      if (content) content.hidden = false;

      return result;

    } catch (error) {
      console.error(
        "Campus access verification:",
        error
      );

      if (message) {
        message.textContent =
          "We couldn't verify your campus access. Please try again.";
      }

      return {
        allowed: false,
        reason: "verification_error",
        error
      };
    }
  }

  window.BB_CAMPUS_GUARD = {
    getClient,
    checkAccess,
    protectPage
  };

})();
