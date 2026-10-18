
(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);

  function make(tag, className = "", text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  const reasons = {
    harassment: "Harassment or bullying",
    hate_speech: "Hate speech",
    spam: "Spam or advertising",
    inappropriate: "Inappropriate content",
    spoilers: "Unmarked book spoilers",
    other: "Other concern"
  };

  const types = {
    post: "💌 Bulletin Post",
    comment: "💬 Bulletin Comment",
    chat: "☕ Bestie Chat Message"
  };

  async function startModeration() {
    const client = window.BB_CAMPUS_CLIENT;
    const staff = window.BB_CAMPUS_STAFF;

    const root = $("#commonsReportsList");
    const status = $("#commonsReportsStatus");
    const refresh = $("#refreshCommonsReports");

    if (!client || !staff || !root || !status || !refresh) {
      console.error("Campus moderation is missing required elements.");
      return;
    }

    async function loadReports() {
      refresh.disabled = true;
      status.textContent = "💗 Loading campus reports...";

      try {
        const { data: reports, error } = await client
          .from("commons_reports")
          .select(
            "id, reporter_id, target_type, target_id, reason, details, status, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        root.replaceChildren();

        if (!reports.length) {
          status.textContent = "✨ No reports to review!";
          return;
        }

        const pending = reports.filter(
          report => report.status === "pending"
        ).length;

        status.textContent =
          `🚩 ${reports.length} reports · ${pending} pending`;

        for (const report of reports) {
          const card = make("div", "item");

          card.style.cssText =
            "margin:12px 0;padding:16px;" +
            "border:1px solid #edb4d0;border-radius:14px;";

          const heading = make(
            "h4",
            "",
            types[report.target_type] || "Campus Report"
          );

          const reason = make(
            "p",
            "",
            `🚩 Reason: ${reasons[report.reason] || report.reason}`
          );

          const details = make(
            "p",
            "",
            report.details || "No additional details provided."
          );

          const date = make(
            "p",
            "mini",
            `Submitted: ${new Date(
              report.created_at
            ).toLocaleString()}`
          );

          const currentStatus = make(
            "p",
            "mini",
            `Status: ${report.status.toUpperCase()}`
          );

          card.append(
            heading,
            reason,
            details,
            date,
            currentStatus
          );

          if (
            report.status === "pending" ||
            report.status === "reviewing"
          ) {
            const actions = make("div");

            for (const [value, label] of [
              ["reviewing", "👀 Reviewing"],
              ["resolved", "✅ Resolve"],
              ["dismissed", "❌ Dismiss"]
            ]) {
              const button = make(
                "button",
                "btn secondary",
                label
              );

              button.type = "button";
              button.style.margin = "5px";

              button.addEventListener("click", async () => {
                if (
                  !confirm(
                    `Change this report to "${value}"?`
                  )
                ) return;

                button.disabled = true;

                const { error: reviewError } =
                  await client.rpc(
                    "review_commons_report",
                    {
                      p_report_id: report.id,
                      p_status: value
                    }
                  );

                if (reviewError) {
                  console.error(
                    "Review campus report:",
                    reviewError
                  );

                  alert(
                    "Couldn't update this report."
                  );

                  button.disabled = false;
                  return;
                }

                await loadReports();
              });

              actions.append(button);
            }

            card.append(actions);
          }

          root.append(card);
        }
      } catch (error) {
        console.error("Load campus reports:", error);
        status.textContent =
          "Couldn't load reports. Please try again.";
      } finally {
        refresh.disabled = false;
      }
    }

    refresh.addEventListener("click", loadReports);

    await loadReports();
  }

  document.addEventListener(
    "bb:campus-hq-ready",
    startModeration,
    { once: true }
  );
})();
