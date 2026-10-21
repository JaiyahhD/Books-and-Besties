
/* =====================================================
   BESTIE UNIVERSITY 🎓
   PHASE 8.5D — DEAN'S OFFICE MODERATION DESK
   ===================================================== */

(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);

  const REASONS = {
    harassment: "Harassment or bullying",
    hate_speech: "Hate speech",
    spam: "Spam or advertising",
    inappropriate: "Inappropriate content",
    spoilers: "Unmarked book spoilers",
    other: "Other concern"
  };

  const TYPES = {
    post: "💌 Bulletin Post",
    comment: "💬 Bulletin Comment",
    chat: "☕ Bestie Chat Message"
  };

  const STATUS_LABELS = {
    pending: "🚩 Pending",
    reviewing: "👀 Reviewing",
    resolved: "✅ Resolved",
    dismissed: "📁 Dismissed"
  };

  const ACTION_LABELS = {
    reviewing: "👀 Review started",
    resolved: "✅ Report resolved",
    dismissed: "📁 Report dismissed",
    content_removed: "🗑️ Content removed",
    warning_recorded: "⚠️ Warning recorded"
  };

  const TARGET_TABLES = {
    post: "commons_posts",
    comment: "commons_post_comments",
    chat: "commons_chat_messages"
  };

  function make(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function formatDate(value) {
    if (!value) return "Not recorded";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Unknown date"
      : date.toLocaleString();
  }

  function errorMessage(error) {
    return error?.message || "An unexpected error occurred.";
  }

  function makeButton(label, className = "btn secondary") {
    const button = make("button", className, label);
    button.type = "button";
    return button;
  }

  function makeDetail(label, value) {
    const paragraph = make("p", "mini");
    const strong = make("strong", "", `${label}: `);

    paragraph.append(
      strong,
      document.createTextNode(String(value ?? "—"))
    );

    return paragraph;
  }

  function makeContentBox(title, content) {
    const box = make("div");

    box.style.cssText = [
      "padding:14px",
      "margin:12px 0",
      "background:#fff5fa",
      "border:1px solid #edb4d0",
      "border-radius:13px",
      "white-space:pre-wrap",
      "overflow-wrap:anywhere",
      "line-height:1.6"
    ].join(";");

    const heading = make("strong", "", title);
    const body = make("div", "", content);

    body.style.marginTop = "9px";

    box.append(heading, body);

    return box;
  }

  function makeField(labelText, input) {
    const label = make("label", "field");
    const title = make("span", "", labelText);

    label.append(title, input);

    return label;
  }

  function createSelect(options) {
    const select = document.createElement("select");

    for (const [value, label] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }

    return select;
  }

  async function startModeration() {
    const client = window.BB_CAMPUS_CLIENT;
    const staff = window.BB_CAMPUS_STAFF;

    const root = $("#commonsReportsList");
    const status = $("#commonsReportsStatus");
    const refresh = $("#refreshCommonsReports");

    if (!client || !staff || !root || !status || !refresh) {
      console.error(
        "Campus moderation is missing required elements."
      );
      return;
    }

    // Prevent duplicate initialization.
    if (root.dataset.moderationStarted === "true") return;
    root.dataset.moderationStarted = "true";

    let allReports = [];
    let isLoading = false;

    // -------------------------------------------------
    // FILTER CONTROLS
    // -------------------------------------------------

    const controls = make("div", "item");

    const controlsTitle = make(
      "h3",
      "",
      "🎀 Dean's Office Report Filters"
    );

    const filterGrid = make("div", "form-grid");

    const statusFilter = createSelect([
      ["active", "🚩 Active Reports"],
      ["all", "📋 All Reports"],
      ["pending", "🚩 Pending"],
      ["reviewing", "👀 Reviewing"],
      ["resolved", "✅ Resolved"],
      ["dismissed", "📁 Dismissed"]
    ]);

    const typeFilter = createSelect([
      ["all", "All Commons Content"],
      ["post", "💌 Bulletin Posts"],
      ["comment", "💬 Bulletin Comments"],
      ["chat", "☕ Bestie Chat"]
    ]);

    filterGrid.append(
      makeField("Report Status", statusFilter),
      makeField("Content Type", typeFilter)
    );

    const counts = make("p", "mini");
    counts.setAttribute("role", "status");

    controls.append(
      controlsTitle,
      filterGrid,
      counts
    );

    root.before(controls);

    // -------------------------------------------------
    // SUPABASE HELPERS
    // -------------------------------------------------

    async function getEvidence(reportId) {
      const { data, error } = await client.rpc(
        "get_commons_report_evidence",
        { p_report_id: reportId }
      );

      if (error) throw error;

      return data;
    }

    async function getOriginalContent(report) {
      const table = TARGET_TABLES[report.target_type];

      if (!table) {
        return {
          exists: false,
          content: null,
          error: "Unsupported report target."
        };
      }

      const { data, error } = await client
        .from(table)
        .select("id, content")
        .eq("id", report.target_id)
        .maybeSingle();

      if (error) {
        return {
          exists: false,
          content: null,
          error: errorMessage(error)
        };
      }

      return {
        exists: Boolean(data),
        content: data?.content ?? null,
        error: null
      };
    }

    async function getHistory(reportId) {
      const { data, error } = await client
        .from("commons_moderation_actions")
        .select(
          "id, actor_id, action_type, notes, created_at"
        )
        .eq("report_id", reportId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return data || [];
    }

    async function changeReportStatus(report, newStatus) {
      const message =
        newStatus === "reviewing"
          ? "Start reviewing this report?"
          : newStatus === "resolved"
            ? "Resolve this report without removing content?"
            : "Dismiss this report without removing content?";

      if (!window.confirm(message)) return;

      const { error } = await client.rpc(
        "review_commons_report",
        {
          p_report_id: report.id,
          p_status: newStatus
        }
      );

      if (error) throw error;
    }

    async function removeContent(report, notes) {
      const { error } = await client.rpc(
        "remove_reported_commons_content",
        {
          p_report_id: report.id,
          p_notes: notes
        }
      );

      if (error) throw error;
    }

    // -------------------------------------------------
    // HISTORY VIEW
    // -------------------------------------------------

    async function showHistory(report, container, button) {
      button.disabled = true;
      container.replaceChildren(
        make("p", "mini", "💗 Loading review history...")
      );

      try {
        const history = await getHistory(report.id);

        container.replaceChildren();

        if (!history.length) {
          container.append(
            make(
              "p",
              "mini",
              "📁 No individual actions were recorded for this report. Older decisions may predate the moderation-history upgrade."
            )
          );

          return;
        }

        for (const action of history) {
          const item = make("div", "item");

          item.append(
            make(
              "strong",
              "",
              ACTION_LABELS[action.action_type] ||
                action.action_type
            ),
            makeDetail(
              "When",
              formatDate(action.created_at)
            ),
            makeDetail(
              "Staff account",
              action.actor_id
            )
          );

          if (action.notes) {
            item.append(
              makeDetail("Staff notes", action.notes)
            );
          }

          container.append(item);
        }
      } catch (error) {
        console.error("Moderation history:", error);

        container.replaceChildren(
          make(
            "p",
            "mini",
            `⚠️ Couldn't load history: ${errorMessage(error)}`
          )
        );
      } finally {
        button.disabled = false;
      }
    }

    // -------------------------------------------------
    // REPORT DETAIL VIEW
    // -------------------------------------------------

    async function showReportDetails(report, container) {
      container.replaceChildren(
        make("p", "mini", "💗 Loading report details...")
      );

      try {
        const [original, evidenceResult] =
          await Promise.all([
            getOriginalContent(report),
            getEvidence(report.id)
              .then(data => ({ data, error: null }))
              .catch(error => ({ data: null, error }))
          ]);

        container.replaceChildren();

        const information = make("div", "item");

        information.append(
          makeDetail(
            "Report ID",
            report.id
          ),
          makeDetail(
            "Reason",
            REASONS[report.reason] || report.reason
          ),
          makeDetail(
            "Submitted",
            formatDate(report.created_at)
          ),
          makeDetail(
            "Status",
            STATUS_LABELS[report.status] || report.status
          ),
          makeDetail(
            "Last reviewed",
            formatDate(report.reviewed_at)
          ),
          makeDetail(
            "Last reviewer",
            report.reviewed_by || "Not yet reviewed"
          )
        );

        information.append(
          makeContentBox(
            "💌 REPORTER'S DETAILS",
            report.details ||
              "No additional details provided."
          )
        );

        container.append(information);

        // Current content
        if (original.error) {
          container.append(
            makeContentBox(
              "⚠️ CURRENT CONTENT",
              "The current content couldn't be retrieved."
            )
          );
        } else if (original.exists) {
          container.append(
            makeContentBox(
              "📖 CURRENT REPORTED CONTENT",
              original.content
            )
          );
        } else {
          container.append(
            makeContentBox(
              "🗑️ CURRENT CONTENT",
              "The original content is no longer available."
            )
          );
        }

        // Preserved evidence
        if (evidenceResult.error) {
          container.append(
            makeContentBox(
              "🔒 SAVED MODERATION EVIDENCE",
              "Evidence couldn't be retrieved."
            )
          );
        } else {
          container.append(
            makeContentBox(
              "🔐 SAVED MODERATION EVIDENCE",
              evidenceResult.data === null
                ? "No evidence snapshot is available for this report."
                : evidenceResult.data
            )
          );
        }

        // Staff actions
        if (
          report.status === "pending" ||
          report.status === "reviewing"
        ) {
          const actionPanel = make("div", "item");

          actionPanel.append(
            make("h4", "", "🛡️ Staff Decisions")
          );

          const actionButtons = make("div", "actions");

          const availableActions = [
            ["reviewing", "👀 Start Reviewing"],
            ["resolved", "✅ Resolve"],
            ["dismissed", "📁 Dismiss"]
          ];

          for (const [value, label] of availableActions) {
            if (
              value === "reviewing" &&
              report.status === "reviewing"
            ) {
              continue;
            }

            const button = makeButton(label);

            button.addEventListener("click", async () => {
              button.disabled = true;

              try {
                await changeReportStatus(report, value);

                // A cancelled confirmation does not
                // modify the database; reloading is safe.
                await loadReports();
              } catch (error) {
                console.error(
                  "Review Commons report:",
                  error
                );

                window.alert(
                  `Couldn't update report: ${errorMessage(error)}`
                );

                button.disabled = false;
              }
            });

            actionButtons.append(button);
          }

          actionPanel.append(actionButtons);

          // Secure content removal
          if (original.exists && !original.error) {
            const removalTitle = make(
              "h4",
              "",
              "🗑️ Remove Reported Content"
            );

            const explanation = document.createElement(
              "textarea"
            );

            explanation.maxLength = 2000;
            explanation.rows = 4;
            explanation.placeholder =
              "Explain why this content must be removed...";
            explanation.style.width = "100%";

            const removalField = makeField(
              "Required staff explanation",
              explanation
            );

            const removalWarning = make(
              "p",
              "mini",
              report.target_type === "post"
                ? "⚠️ Removing a Bulletin post also deletes its comments and reactions."
                : "⚠️ This permanently deletes the reported content."
            );

            const removeButton = makeButton(
              "🗑️ Remove Content & Resolve Report",
              "btn danger"
            );

            removeButton.addEventListener(
              "click",
              async () => {
                const notes = explanation.value.trim();

                if (!notes) {
                  window.alert(
                    "Please enter a staff explanation before removing content."
                  );
                  explanation.focus();
                  return;
                }

                const warning =
                  report.target_type === "post"
                    ? "This will permanently delete the post, its comments, and reactions."
                    : "This will permanently delete the reported content.";

                if (
                  !window.confirm(
                    "🛡️ DEAN'S OFFICE MODERATION\n\n" +
                    warning +
                    "\n\nThe report will be resolved and the removal recorded in moderation history.\n\n" +
                    "Continue?"
                  )
                ) {
                  return;
                }

                removeButton.disabled = true;
                removeButton.textContent =
                  "💗 Removing securely...";

                try {
                  await removeContent(report, notes);

                  window.alert(
                    "💗 Content removed, report resolved, and moderation action recorded!"
                  );

                  await loadReports();
                } catch (error) {
                  console.error(
                    "Secure Commons removal:",
                    error
                  );

                  window.alert(
                    `Couldn't remove content: ${errorMessage(error)}`
                  );

                  removeButton.disabled = false;
                  removeButton.textContent =
                    "🗑️ Remove Content & Resolve Report";
                }
              }
            );

            actionPanel.append(
              removalTitle,
              removalWarning,
              removalField,
              removeButton
            );
          } else if (!original.error) {
            actionPanel.append(
              make(
                "p",
                "mini",
                "📁 This content is already missing. You can still resolve or dismiss the report."
              )
            );
          }

          container.append(actionPanel);
        }

        // History
        const historyPanel = make("div", "item");

        const historyTitle = make(
          "h4",
          "",
          "📜 Permanent Review History"
        );

        const historyButton = makeButton(
          "📜 View Action History",
          "btn light"
        );

        const historyContainer = make("div");

        historyButton.addEventListener(
          "click",
          () => {
            showHistory(
              report,
              historyContainer,
              historyButton
            );
          }
        );

        historyPanel.append(
          historyTitle,
          historyButton,
          historyContainer
        );

        container.append(historyPanel);
      } catch (error) {
        console.error(
          "Load report details:",
          error
        );

        container.replaceChildren(
          make(
            "p",
            "mini",
            `⚠️ Couldn't load report details: ${errorMessage(error)}`
          )
        );
      }
    }

    // -------------------------------------------------
    // REPORT CARDS
    // -------------------------------------------------

    function renderReports() {
      root.replaceChildren();

      const filtered = allReports.filter(report => {
        const selectedStatus = statusFilter.value;
        const selectedType = typeFilter.value;

        const matchesStatus =
          selectedStatus === "all" ||
          (
            selectedStatus === "active" &&
            (
              report.status === "pending" ||
              report.status === "reviewing"
            )
          ) ||
          report.status === selectedStatus;

        const matchesType =
          selectedType === "all" ||
          report.target_type === selectedType;

        return matchesStatus && matchesType;
      });

      if (!filtered.length) {
        root.append(
          make(
            "p",
            "empty",
            "✨ No reports match these filters, Bestie!"
          )
        );

        return;
      }

      for (const report of filtered) {
        const card = make("div", "item");

        card.style.cssText = [
          "margin:14px 0",
          "padding:18px",
          "border:2px solid #edb4d0",
          "border-radius:16px"
        ].join(";");

        const heading = make(
          "h4",
          "",
          TYPES[report.target_type] ||
            "🚩 Campus Report"
        );

        const statusTag = make(
          "span",
          "tag",
          STATUS_LABELS[report.status] ||
            report.status
        );

        if (report.status === "resolved") {
          statusTag.classList.add("green");
        }

        if (report.status === "dismissed") {
          statusTag.classList.add("gray");
        }

        const summary = make(
          "p",
          "",
          `🚩 ${REASONS[report.reason] || report.reason}`
        );

        const submitted = make(
          "p",
          "mini",
          `Submitted: ${formatDate(report.created_at)}`
        );

        const detailsButton = makeButton(
          "🔎 Open Report & Evidence",
          "btn secondary"
        );

        detailsButton.setAttribute(
          "aria-expanded",
          "false"
        );

        const detailsContainer = make("div");
        detailsContainer.hidden = true;

        detailsButton.addEventListener(
          "click",
          async () => {
            const opening = detailsContainer.hidden;

            detailsContainer.hidden = !opening;

            detailsButton.setAttribute(
              "aria-expanded",
              String(opening)
            );

            detailsButton.textContent = opening
              ? "💗 Close Report"
              : "🔎 Open Report & Evidence";

            if (opening) {
              await showReportDetails(
                report,
                detailsContainer
              );
            }
          }
        );

        card.append(
          heading,
          statusTag,
          summary,
          submitted,
          detailsButton,
          detailsContainer
        );

        root.append(card);
      }
    }

    // -------------------------------------------------
    // LOAD REPORTS
    // -------------------------------------------------

    async function loadReports() {
      if (isLoading) return;

      isLoading = true;
      refresh.disabled = true;

      status.textContent =
        "💗 Loading Dean's Office reports...";

      try {
        const { data, error } = await client
          .from("commons_reports")
          .select(
            "id, reporter_id, target_type, target_id, " +
            "reason, details, status, created_at, " +
            "reviewed_by, reviewed_at"
          )
          .order("created_at", { ascending: false })
          .limit(500);

        if (error) throw error;

        allReports = data || [];

        const pending = allReports.filter(
          report => report.status === "pending"
        ).length;

        const reviewing = allReports.filter(
          report => report.status === "reviewing"
        ).length;

        const resolved = allReports.filter(
          report => report.status === "resolved"
        ).length;

        const dismissed = allReports.filter(
          report => report.status === "dismissed"
        ).length;

        const active = pending + reviewing;

        status.textContent =
          `🚩 ${active} active reports · ` +
          `${allReports.length} loaded`;

        counts.textContent =
          `🚩 Pending: ${pending}  |  ` +
          `👀 Reviewing: ${reviewing}  |  ` +
          `✅ Resolved: ${resolved}  |  ` +
          `📁 Dismissed: ${dismissed}`;

        renderReports();
      } catch (error) {
        console.error(
          "Load campus reports:",
          error
        );

        status.textContent =
          `⚠️ Couldn't load reports: ${errorMessage(error)}`;
      } finally {
        isLoading = false;
        refresh.disabled = false;
      }
    }

    // -------------------------------------------------
    // EVENTS
    // -------------------------------------------------

    statusFilter.addEventListener(
      "change",
      renderReports
    );

    typeFilter.addEventListener(
      "change",
      renderReports
    );

    refresh.addEventListener(
      "click",
      loadReports
    );

    await loadReports();
  }

  document.addEventListener(
    "bb:campus-hq-ready",
    startModeration,
    { once: true }
  );
})();
