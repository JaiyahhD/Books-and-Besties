
(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);

  function make(tag, className = "", text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function formatTime(value) {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  async function startChat(client, user) {
    const root = $("#chatMessages");
    const input = $("#chatText");
    const sendButton = $("#sendChat");

    if (!root || !input || !sendButton) {
      console.error("Bestie Chat elements are missing.");
      return;
    }

    sendButton.textContent = "Send to Bestie Chat 💌";

    let loading = false;

    async function loadMessages() {
      if (loading) return;
      loading = true;

      try {
        const { data, error } = await client
          .from("commons_chat_messages")
          .select("id, author_id, content, created_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          console.error("Bestie Chat loading:", error);
          root.replaceChildren(
            make("p", "", "Couldn't load Bestie Chat.")
          );
          return;
        }

        const messages = [...(data || [])].reverse();
        const authorIds = [
          ...new Set(messages.map(message => message.author_id))
        ];

        let names = new Map();

        if (authorIds.length) {
          const { data: profiles, error: profileError } = await client
            .from("profiles")
            .select("id, display_name")
            .in("id", authorIds);

          if (profileError) {
            console.warn("Bestie Chat author names:", profileError);
          }

          names = new Map(
            (profiles || []).map(profile => [
              profile.id,
              profile.display_name || "Bestie"
            ])
          );
        }

        root.replaceChildren();

        if (!messages.length) {
          root.append(
            make(
              "p",
              "",
              "☕ The lounge is quiet! Be the first Bestie to say heyyy!"
            )
          );
          return;
        }

        for (const message of messages) {
          const mine = message.author_id === user.id;

          const bubble = make(
            "div",
            mine ? "bubble mine" : "bubble"
          );

          bubble.append(
            make(
              "strong",
              "",
              `${names.get(message.author_id) || "Campus Bestie"} · ${
                formatTime(message.created_at)
              }`
            ),
            make("span", "", message.content)
          );

          if (mine) {
            const remove = make(
              "button",
              "reaction",
              "🗑️ Delete"
            );

            remove.type = "button";
            remove.style.cssText =
              "display:block;margin-top:8px;font-size:12px;";

            remove.addEventListener("click", async () => {
              if (!confirm("Delete this chat message?")) return;

              remove.disabled = true;

              const { error: deleteError } = await client
                .from("commons_chat_messages")
                .delete()
                .eq("id", message.id)
                .eq("author_id", user.id);

              if (deleteError) {
                console.error("Delete chat message:", deleteError);
                alert("Couldn't delete this message.");
                remove.disabled = false;
                return;
              }

              await loadMessages();
            });

            bubble.append(remove);
          }

          root.append(bubble);
        }

        root.scrollTop = root.scrollHeight;
      } finally {
        loading = false;
      }
    }

    async function sendMessage() {
      const content = input.value.trim();

      if (!content || sendButton.disabled) return;

      sendButton.disabled = true;
      sendButton.textContent = "Sending... 💗";

      const { error } = await client
        .from("commons_chat_messages")
        .insert({
          author_id: user.id,
          content
        });

      sendButton.disabled = false;
      sendButton.textContent = "Send to Bestie Chat 💌";

      if (error) {
        console.error("Send Bestie Chat message:", error);
        alert("Couldn't send your message. Please try again.");
        return;
      }

      input.value = "";
      await loadMessages();
    }

    sendButton.addEventListener("click", sendMessage);

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });

    // Refresh chat when the Bestie opens its tab.
    $("#chatTab").addEventListener("click", loadMessages);

    await loadMessages();

    window.BB_COMMONS_CHAT_REFRESH = loadMessages;
  }

  window.BB_COMMONS_CHAT = { startChat };
})();
