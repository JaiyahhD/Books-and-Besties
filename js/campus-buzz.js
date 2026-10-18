
(() => {
  "use strict";

  function make(tag, className = "", text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  async function startCampusBuzz(client) {
    const root = document.querySelector("#campusBuzz");

    if (!root) {
      console.error("Campus Buzz container is missing.");
      return;
    }

    async function loadAnnouncements() {
      root.replaceChildren(
        make("p", "", "💗 Loading campus announcements...")
      );

      const { data, error } = await client
        .from("campus_announcements")
        .select("id, title, message, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Campus Buzz:", error);
        root.replaceChildren(
          make(
            "p",
            "",
            "Campus announcements couldn't load. Please try refreshing."
          )
        );
        return;
      }

      root.replaceChildren();

      if (!data.length) {
        root.append(
          make(
            "p",
            "",
            "📣 Campus Buzz is quiet for now. Stay tuned, Besties!"
          )
        );
        return;
      }

      for (const announcement of data) {
        const card = make("div", "announcement");

        const title = make(
          "strong",
          "",
          "📣 " + announcement.title
        );

        const message = make(
          "p",
          "",
          announcement.message
        );

        message.style.cssText =
          "margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;";

        const date = make(
          "small",
          "",
          new Date(announcement.created_at).toLocaleDateString(
            "en-US",
            {
              month: "short",
              day: "numeric",
              year: "numeric"
            }
          )
        );

        card.append(title, message, date);
        root.append(card);
      }
    }

    await loadAnnouncements();

    window.BB_CAMPUS_BUZZ_REFRESH = loadAnnouncements;
  }

  window.BB_CAMPUS_BUZZ = { startCampusBuzz };
})();
