
/* ==========================================
   BESTIE UNIVERSITY 🎓💗
   CAMPUS HQ — AUTHENTICATION GATE
   ========================================== */

(() => {
  "use strict";

  const config = window.BB_CONFIG;

  const gate = document.getElementById("campusAuthGate");
  const dashboard = document.getElementById("campusDashboard");
  const message = document.getElementById("campusAuthMessage");

  function showGate(text) {
    if (gate) gate.hidden = false;
    if (dashboard) dashboard.hidden = true;
    if (message) message.textContent = text;
  }

  function showDashboard() {
    if (gate) gate.hidden = true;
    if (dashboard) dashboard.hidden = false;
  }

  async function initialize() {
    if (
      !window.supabase ||
      !config?.SUPABASE_URL ||
      !config?.SUPABASE_ANON_KEY
    ) {
      showGate("Campus HQ configuration is unavailable.");
      return;
    }

    const client = window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    );

    window.BB_CAMPUS_CLIENT = client;

    const {
      data: { user },
      error: authError
    } = await client.auth.getUser();

    if (authError || !user) {
      showGate(
        "🗝️ The Dean's Office is reserved for campus staff. " +
        "Please sign in with your approved staff account."
      );
      return;
    }

    const { data: profile, error: profileError } =
      await client
        .from("profiles")
        .select("display_name, membership_status")
        .eq("id", user.id)
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.membership_status !== "approved"
    ) {
      showGate("Your campus membership is not approved.");
      return;
    }

    const { data: staff, error: staffError } =
      await client
        .from("campus_staff")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (
      staffError ||
      !staff ||
      !["admin", "moderator"].includes(staff.role)
    ) {
      showGate(
        "This office is reserved for authorized campus staff."
      );
      return;
    }

    window.BB_CAMPUS_STAFF = {
      id: user.id,
      displayName: profile.display_name,
      role: staff.role
    };

    showDashboard();

    document.dispatchEvent(
      new CustomEvent("bb:campus-hq-ready", {
        detail: {
          role: staff.role
        }
      })
    );
  }

  initialize().catch(error => {
    console.error("Campus HQ authentication:", error);
    showGate("Unable to verify campus staff access.");
  });
})();
