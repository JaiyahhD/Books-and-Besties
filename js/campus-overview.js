
/* ==========================================
   BESTIE UNIVERSITY 🎓💗
   CAMPUS OVERVIEW — LIVE SUPABASE STATISTICS
   ========================================== */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  let initialized = false;
  let loading = false;

  async function loadCampusOverview() {
    const client = window.BB_CAMPUS_CLIENT;

    if (!client) {
      console.error(
        "Campus Overview: Campus HQ Supabase client unavailable."
      );
      return;
    }

    if (loading) return;
    loading = true;

    try {
      const { data, error } = await client.rpc(
        "get_campus_overview_stats"
      );

      if (error) {
        throw error;
      }

      const stats = Array.isArray(data) ? data[0] : data;

      if (!stats) {
        throw new Error(
          "No campus statistics returned. Check staff permissions."
        );
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
        "👑 LIVE CAMPUS OVERVIEW:",
        stats
      );

    } catch (error) {
      console.error(
        "Campus Overview failed:",
        error
      );
    } finally {
      loading = false;
    }
  }

  function initialize() {
    if (initialized) return;
    initialized = true;

    loadCampusOverview();

    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          loadCampusOverview();
        }
      }
    );

    // Refresh statistics when navigating to Overview.
    document.querySelectorAll(
      '[data-section="overview"]'
    ).forEach(button => {
      button.addEventListener(
        "click",
        loadCampusOverview
      );
    });
  }

  // The Campus HQ authentication script creates
  // BB_CAMPUS_CLIENT and BB_CAMPUS_STAFF.
  //
  // This works whether authentication finishes
  // before or after this script loads.

  if (
    window.BB_CAMPUS_CLIENT &&
    window.BB_CAMPUS_STAFF
  ) {
    initialize();
  } else {
    document.addEventListener(
      "bb:campus-hq-ready",
      initialize,
      { once: true }
    );
  }

})();
