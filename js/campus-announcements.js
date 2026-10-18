
/* ==========================================
   BESTIE UNIVERSITY 🎓💗
   CAMPUS ANNOUNCEMENTS
   Secure Admin Publishing
   ========================================== */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  let initialized = false;
  let publishing = false;

  function setStatus(message, isError = false) {
    const status = $("announcementStatus");

    if (!status) return;

    status.textContent = message;
    status.style.color = isError ? "#a33356" : "#286e70";
  }

  function initializeAnnouncements() {
    if (initialized) return;

    const form = $("announcementForm");
    const titleInput = $("announcementTitle");
    const messageInput = $("announcementMessage");
    const publishButton = $("publishAnnouncement");

    if (!form || !titleInput || !messageInput || !publishButton) {
      console.error(
        "Campus Announcements: Composer elements not found."
      );
      return;
    }

    const client = window.BB_CAMPUS_CLIENT;
    const staff = window.BB_CAMPUS_STAFF;

    if (!client || !staff) {
      setStatus("Campus staff verification is unavailable.", true);
      return;
    }

    initialized = true;
    form.hidden = false;

    // Only admins can publish.
    // Supabase independently enforces this permission.

    if (staff.role !== "admin") {
      publishButton.disabled = true;
      setStatus(
        "Only campus administrators can publish announcements."
      );
      return;
    }

    setStatus("Ready to send Campus Mail! 💌");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (publishing) return;

      const title = titleInput.value.trim();
      const message = messageInput.value.trim();

      if (!title || !message) {
        setStatus("Please enter a title and message.", true);
        return;
      }

      if (title.length > 150) {
        setStatus(
          "Announcement titles must be 150 characters or fewer.",
          true
        );
        return;
      }

      if (message.length > 2000) {
        setStatus(
          "Announcement messages must be 2,000 characters or fewer.",
          true
        );
        return;
      }

      const confirmed = window.confirm(
        "💌 Publish this announcement to ALL approved Besties?\n\n" +
        "Title: " + title + "\n\n" +
        "This will send a real Campus Mail notification."
      );

      if (!confirmed) return;

      publishing = true;
      publishButton.disabled = true;
      publishButton.textContent = "💌 Sending Campus Mail...";
      setStatus("Delivering your announcement...");

      try {
        const {
          data: recipientCount,
          error
        } = await client.rpc("send_campus_announcement", {
          p_title: title,
          p_message: message
        });

        if (error) throw error;

        const count = Number(recipientCount);

        setStatus(
          `💗 Announcement published! Delivered to ${count} ` +
          `approved Bestie${count === 1 ? "" : "s"}!`
        );

        form.reset();

      } catch (error) {
        console.error("Campus announcement error:", error);

        setStatus(
          "Unable to publish: " +
          (error.message || "Please try again."),
          true
        );

      } finally {
        publishing = false;
        publishButton.disabled = false;
        publishButton.textContent = "💌 Publish Campus Announcement";
      }
    });
  }

  // Initialize once Campus HQ authentication finishes.
document.addEventListener(
  "bb:campus-hq-ready",
  initializeAnnouncements
);

// Handle cases where authentication completed
// before this script was loaded.
if (window.BB_CAMPUS_CLIENT && window.BB_CAMPUS_STAFF) {
  initializeAnnouncements();
}
})();
