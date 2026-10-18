
/* ==========================================
   BESTIE UNIVERSITY 🎓💗
   LIVE CAMPUS ADMISSIONS
   ========================================== */

(() => {
  "use strict";

  let client = null;
  let staffRole = null;
  let loading = false;

  const $ = id => document.getElementById(id);

  function makeElement(tag, text, className) {
    const element = document.createElement(tag);

    if (text !== undefined) {
      element.textContent = text;
    }

    if (className) {
      element.className = className;
    }

    return element;
  }

  function showNotice(text) {
    const notice = $("admissionsNotice");

    if (notice) {
      notice.textContent = text;
    }
  }

  function createButton(label, className, handler) {
    const button = makeElement(
      "button",
      label,
      "btn " + className
    );

    button.type = "button";
    button.addEventListener("click", handler);

    return button;
  }

  async function reviewApplication(userId, decision, name) {
    if (staffRole !== "admin") {
      showNotice(
        "Only campus administrators can review applications."
      );
      return;
    }

    const action =
      decision === "approved" ? "approve" : "decline";

    if (
      !confirm(
        `Are you sure you want to ${action} ${name}?`
      )
    ) {
      return;
    }

    showNotice("Processing the admissions decision...");

    const { error } = await client.rpc(
      "review_campus_application",
      {
        p_user_id: userId,
        p_decision: decision
      }
    );

    if (error) {
      console.error("Admissions review failed:", error);

      showNotice(
        "Unable to save this decision: " + error.message
      );
      return;
    }

    showNotice(
      `${name}'s application was ${decision} successfully. 💗`
    );

    await loadAdmissions();
  }

  function renderApplicants(applicants) {
    const list = $("memberList");

    if (!list) return;

    list.replaceChildren();

    if (!applicants.length) {
      list.append(
        makeElement(
          "p",
          "💌 No campus applications found.",
          "empty"
        )
      );
      return;
    }

    const sorted = [...applicants].sort((a, b) => {
      const rank = {
        pending: 0,
        approved: 1,
        declined: 2,
        suspended: 3
      };

      const difference =
        (rank[a.membership_status] ?? 9) -
        (rank[b.membership_status] ?? 9);

      if (difference !== 0) return difference;

      return (
        new Date(b.created_at || 0) -
        new Date(a.created_at || 0)
      );
    });

    sorted.forEach(applicant => {
      const status = applicant.membership_status;

      const card = makeElement(
        "div",
        undefined,
        "item"
      );

      card.append(
        makeElement(
          "h4",
          "🎓 " + (applicant.display_name || "Bestie")
        )
      );

      card.append(
        makeElement(
          "p",
          "Campus membership application"
        )
      );

      const statusTag = makeElement(
        "span",
        status.toUpperCase(),
        "tag " + (
          status === "approved" ? "green" : "gray"
        )
      );

      card.append(statusTag);

      if (applicant.created_at) {
        const date = new Date(applicant.created_at);

        card.append(
          makeElement(
            "p",
            "Applied: " +
              date.toLocaleDateString(),
            "mini"
          )
        );
      }

      if (
        status === "pending" &&
        staffRole === "admin"
      ) {
        const actions = makeElement(
          "div",
          undefined,
          "actions"
        );

        actions.append(
          createButton(
            "✓ Approve",
            "secondary",
            () => reviewApplication(
              applicant.id,
              "approved",
              applicant.display_name || "this Bestie"
            )
          )
        );

        actions.append(
          createButton(
            "Decline",
            "danger",
            () => reviewApplication(
              applicant.id,
              "declined",
              applicant.display_name || "this Bestie"
            )
          )
        );

        card.append(actions);
      }

      list.append(card);
    });
  }

  function updateOverview(applicants) {
    const pending = applicants.filter(
      applicant =>
        applicant.membership_status === "pending"
    ).length;

    const approved = applicants.filter(
      applicant =>
        applicant.membership_status === "approved"
    ).length;

    if ($("statMembers")) {
      $("statMembers").textContent = approved;
    }

    if ($("statPending")) {
      $("statPending").textContent = pending;
    }

    const todo = $("todoList");

    if (todo) {
      const admissionsTask = todo.querySelector(
        "[data-live-admissions-task]"
      );

      if (admissionsTask) {
        admissionsTask.remove();
      }

      const task = makeElement(
        "div",
        undefined,
        "item"
      );

      task.dataset.liveAdmissionsTask = "true";

      task.append(
        makeElement(
          "h4",
          "🎓 Live Member Admissions"
        )
      );

      task.append(
        makeElement(
          "p",
          `${pending} real applications awaiting review.`
        )
      );

      todo.prepend(task);
    }
  }

  async function loadAdmissions() {
    if (!client || loading) return;

    loading = true;
    showNotice("Loading live campus applications...");

    try {
      const { data, error } = await client
        .from("profiles")
        .select(
          "id, display_name, membership_status, created_at"
        )
        .order("created_at", {
          ascending: false
        });

      if (error) throw error;

      const applicants = data || [];

      renderApplicants(applicants);
      updateOverview(applicants);

      showNotice(
        `💗 Live admissions connected! ` +
        `${applicants.length} campus profiles loaded.`
      );
    } catch (error) {
      console.error(
        "Unable to load admissions:",
        error
      );

      if ($("memberList")) {
        $("memberList").replaceChildren(
          makeElement(
            "p",
            "Could not load live admissions. " +
              "Please check your Supabase permissions.",
            "empty"
          )
        );
      }

      showNotice(
        "Admissions connection failed: " +
        error.message
      );
    } finally {
      loading = false;
    }
  }

  document.addEventListener(
    "bb:campus-hq-ready",
    async event => {
      client = window.BB_CAMPUS_CLIENT;
      staffRole = event.detail.role;

      if (!client) {
        showNotice(
          "Campus authentication client unavailable."
        );
        return;
      }

      await loadAdmissions();
    }
  );
})();
