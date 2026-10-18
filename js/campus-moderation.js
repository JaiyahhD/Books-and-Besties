
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

          
          // Look up the original reported content.
          const targetTables = {
            post: "commons_posts",
            comment: "commons_post_comments",
            chat: "commons_chat_messages"
          };

          const contentBox = make(
            "div",
            "",
            "💗 Loading reported content..."
          );

          contentBox.style.cssText =
            "padding:12px;margin:12px 0;" +
            "background:#fff5fa;border-radius:12px;" +
            "white-space:pre-wrap;overflow-wrap:anywhere;";

          const targetTable = targetTables[report.target_type];

                    let target = null;
          if (targetTable) {
            const { data: foundTarget, error: targetError } =
              await client
                .from(targetTable)
                .select("content")
                .eq("id", report.target_id)
                .maybeSingle();
                target = foundTarget;

            if (targetError) {
              console.error("Reported content:", targetError);
              contentBox.textContent =
                "⚠️ Reported content couldn't be loaded.";
            } else {
              contentBox.textContent = target
                ? `📖 REPORTED CONTENT:\n\n${target.content}`
                : "🗑️ Original content is no longer available.";
            }
          }

          
          // Retrieve the private evidence snapshot.
          // Supabase permits this only for authorized staff.
          const { data: evidence, error: evidenceError } =
            await client.rpc(
              "get_commons_report_evidence",
              { p_report_id: report.id }
            );

          const evidenceBox = make(
            "div",
            "",
            ""
          );

          evidenceBox.style.cssText =
            "padding:12px;margin:12px 0;" +
            "background:#fff0f7;" +
            "border:1px solid #edb4d0;" +
            "border-radius:12px;" +
            "white-space:pre-wrap;" +
            "overflow-wrap:anywhere;";

          if (evidenceError) {
            console.error("Moderation evidence:", evidenceError);
            evidenceBox.textContent =
              "🔒 Evidence couldn't be loaded.";
          } else if (evidence !== null) {
            evidenceBox.textContent =
              `🔐 SAVED MODERATION EVIDENCE:\n\n${evidence}`;
          } else {
            evidenceBox.textContent =
              "📁 No evidence snapshot exists for this older report.";
          }

          
          card.append(
            heading,
            reason,
            contentBox,
            evidenceBox,
            details,
            date,
            currentStatus
          );


          // Allow authorized staff to remove reported content.
          if (targetTable && target) {
            const removeButton = make(
              "button",
              "btn secondary",
              "🗑️ Remove Reported Content"
            );

            removeButton.type = "button";
            removeButton.style.margin = "8px 0";

            removeButton.addEventListener("click", async () => {
              const warning = report.target_type === "post"
                ? "This will permanently delete the post, its comments, and reactions."
                : "This will permanently delete the reported content.";

              if (!confirm(
                `🛡️ DEAN'S OFFICE MODERATION\n\n${warning}\n\nThis action cannot be undone.\n\nContinue?`
              )) {
                return;
              }

              removeButton.disabled = true;
              removeButton.textContent = "Removing content...";

              const { data: deleted, error: deleteError } =
                await client
                  .from(targetTable)
                  .delete()
                  .eq("id", report.target_id)
                  .select("id");

              if (deleteError) {
                console.error("Moderation removal:", deleteError);
                alert("Couldn't remove the reported content.");
                removeButton.disabled = false;
                removeButton.textContent =
                  "🗑️ Remove Reported Content";
                return;
              }

              if (!deleted || deleted.length === 0) {
                alert(
                  "The content was already removed or is no longer available."
                );
                await loadReports();
                return;
              }

              alert("💗 Reported content successfully removed.");
              await loadReports();
            });

            card.append(removeButton);
          }


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
