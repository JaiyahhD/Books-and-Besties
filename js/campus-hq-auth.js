
/* ==========================================
   BESTIE UNIVERSITY 🎓💗
   CAMPUS OVERVIEW — LIVE STATISTICS
   ========================================== */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  let initialized = false;

  async function loadCampusOverview() {
    // Reuse the authenticated Campus HQ client.
    const client = window.BB_CAMPUS_CLIENT;

    if (!client) {
      console.error(
        "Campus Overview: Supabase client unavailable."
      );
      return;
    }

    const { data, error } = await client.rpc(
      "get_campus_overview_stats"
    );

    if (error) {
      console.error(
        "Campus Overview: " + error.message
      );
      return;
    }

    const stats = Array.isArray(data) ? data[0] : data;

    if (!stats) {
      console.warn(
        "Campus Overview: No statistics returned."
      );
      return;
    }

    const values = {
      statMembers: stats.approved_besties,
      statPending: stats.pending_applications,
      statActivities: stats.published_activities,
      statVIP: stats.active_vips
    };

    for (const [id, value] of Object.entries(values)) {
      const element = $(id);

      if (element) {
        element.textContent = Number(
          value ?? 0
        ).toLocaleString();
      }
    }

    console.log(
      "👑 Campus Overview statistics loaded:",
      stats
    );
  }

  function initialize() {
    if (initialized) return;
    initialized = true;

    loadCampusOverview();

    // Refresh statistics when returning to this tab.
    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          loadCampusOverview();
        }
      }
    );
  }

  document.addEventListener(
    "bb:campus-hq-ready",
    initialize
  );
})();
