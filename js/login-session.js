
/* ==========================================
   BESTIE UNIVERSITY 🎓💗
   LOGIN — EXISTING SESSION CHECK
   ========================================== */

(() => {
  "use strict";

  const config = window.BB_CONFIG;
  const message = document.getElementById("loginMessage");
  const button = document.getElementById("loginButton");

  if (
    !window.supabase ||
    !config?.SUPABASE_URL ||
    !config?.SUPABASE_ANON_KEY
  ) {
    return;
  }

  const client = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );

  async function checkExistingSession() {
    try {
      const {
        data: { user },
        error: authError
      } = await client.auth.getUser();

      if (authError || !user) return;

      const { data: profile, error } = await client
        .from("profiles")
        .select("membership_status")
        .eq("id", user.id)
        .maybeSingle();

      if (error || !profile) return;

      if (profile.membership_status === "approved") {
        if (message) {
          message.textContent =
            "🎀 Welcome back, Bestie! Opening your Locker...";
          message.className = "login-message success";
        }

        if (button) button.disabled = true;

        window.location.replace("locker.html");
      }

    } catch (error) {
      console.error(
        "Existing campus session check:",
        error
      );
    }
  }

  checkExistingSession();
})();
