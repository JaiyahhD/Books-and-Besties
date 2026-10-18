
(() => {
  "use strict";

  const REPORT_REASONS = [
    ["harassment", "Harassment or bullying"],
    ["hate_speech", "Hate speech"],
    ["spam", "Spam or advertising"],
    ["inappropriate", "Inappropriate content"],
    ["spoilers", "Unmarked book spoilers"],
    ["other", "Other concern"]
  ];

  function make(tag, className = "", text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function addReportButton(container, targetType, targetId, client, user) {
    const wrapper = make("div", "commons-report-wrapper");

    const reportButton = make(
      "button",
      "reaction",
      "🚩 Report"
    );

    reportButton.type = "button";
    reportButton.style.marginTop = "8px";

    const form = document.createElement("form");
    form.hidden = true;
    form.style.cssText =
      "margin-top:12px;padding:15px;" +
      "background:#fff5fa;border:2px solid #edb4d0;" +
      "border-radius:14px;";

    const heading = make(
      "strong",
      "",
      "🚩 Report this content"
    );

    const reasonLabel = make(
      "label",
      "",
      "Why are you reporting this?"
    );

    reasonLabel.style.display = "block";
    reasonLabel.style.marginTop = "12px";

    const reasonSelect = document.createElement("select");
    reasonSelect.required = true;
    reasonSelect.style.cssText =
      "display:block;width:100%;padding:11px;" +
      "margin-top:6px;border:2px solid #edb4d0;" +
      "border-radius:10px;background:white;";

    reasonSelect.append(
      new Option("Choose a reason...", "")
    );

    for (const [value, label] of REPORT_REASONS) {
      reasonSelect.append(new Option(label, value));
    }

    reasonLabel.append(reasonSelect);

    const detailsLabel = make(
      "label",
      "",
      "Additional details (optional)"
    );

    detailsLabel.style.display = "block";
    detailsLabel.style.marginTop = "12px";

    const details = document.createElement("textarea");
    details.maxLength = 1000;
    details.rows = 3;
    details.placeholder = "Tell the Dean's Office what happened...";
    details.style.cssText =
      "display:block;width:100%;padding:11px;" +
      "margin-top:6px;border:2px solid #edb4d0;" +
      "border-radius:10px;resize:vertical;";

    detailsLabel.append(details);

    const submit = make(
      "button",
      "btn",
      "Send Report to Dean's Office 💌"
    );

    submit.type = "submit";

    const status = make("p", "", "");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    form.append(
      heading,
      reasonLabel,
      detailsLabel,
      submit,
      status
    );

    reportButton.addEventListener("click", () => {
      form.hidden = !form.hidden;
      reportButton.setAttribute(
        "aria-expanded",
        String(!form.hidden)
      );
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const reason = reasonSelect.value;

      if (!reason) {
        status.textContent = "Please choose a reason.";
        return;
      }

      submit.disabled = true;
      status.textContent = "Sending your report... 💗";

      const { error } = await client
        .from("commons_reports")
        .insert({
          reporter_id: user.id,
          target_type: targetType,
          target_id: targetId,
          reason,
          details: details.value.trim() || null
        });

      if (error) {
        console.error("Commons report:", error);
        status.textContent =
          "Your report couldn't be submitted. Please try again.";
        submit.disabled = false;
        return;
      }

      status.textContent =
        "💗 Report submitted! The Dean's Office will review it.";

      reasonSelect.value = "";
      details.value = "";
      submit.disabled = false;
    });

    wrapper.append(reportButton, form);
    container.append(wrapper);
  }

  window.BB_COMMONS_REPORTS = { addReportButton };
})();
