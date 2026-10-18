
(() => {
  "use strict";

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

  async function addComments(article, post, client, user) {
    const section = make("div", "commons-comments");
    const toggle = make("button", "reaction", "💬 Comments");
    const panel = make("div", "commons-comments-panel");

    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    panel.hidden = true;

    const countResult = await client
      .from("commons_post_comments")
      .select("id", { count: "exact", head: true })
      .eq("post_id", post.id);

    if (countResult.error) {
      console.error("Comment count:", countResult.error);
    }

    let count = countResult.count || 0;

    function updateLabel() {
      toggle.textContent = `💬 Comments · ${count}`;
    }

    updateLabel();

    async function loadComments() {
      panel.replaceChildren(
        make("p", "", "💗 Loading comments...")
      );

      const { data: comments, error } = await client
        .from("commons_post_comments")
        .select("id, author_id, content, created_at")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) {
        console.error("Load comments:", error);
        panel.replaceChildren(
          make("p", "", "Couldn't load comments. Please try again.")
        );
        return;
      }

      count = Math.max(count, comments.length);
      updateLabel();

      const authorIds = [...new Set(comments.map(c => c.author_id))];
      let names = new Map();

      if (authorIds.length) {
        const { data: profiles, error: profilesError } = await client
          .from("profiles")
          .select("id, display_name")
          .in("id", authorIds);

        if (profilesError) {
          console.warn("Comment authors:", profilesError);
        }

        names = new Map(
          (profiles || []).map(profile => [
            profile.id,
            profile.display_name || "Bestie"
          ])
        );
      }

      const list = make("div", "commons-comment-list");

      if (!comments.length) {
        list.append(
          make("p", "", "Be the first Bestie to comment! 💗")
        );
      }

      for (const comment of comments) {
        const item = make("div", "commons-comment");

        item.style.cssText =
          "padding:12px;margin:10px 0;border-radius:14px;" +
          "background:#fff0f7;border:1px solid #efbfd5;";

        item.append(
          make(
            "strong",
            "",
            `${names.get(comment.author_id) || "Campus Bestie"} · ${
              formatTime(comment.created_at)
            }`
          ),
          make("p", "", comment.content)
        );

        if (comment.author_id === user.id) {
          const deleteButton = make(
            "button",
            "reaction",
            "🗑️ Delete Comment"
          );

          deleteButton.type = "button";

          deleteButton.addEventListener("click", async () => {
            if (!confirm("Delete your comment?")) return;

            deleteButton.disabled = true;

            const { error: deleteError } = await client
              .from("commons_post_comments")
              .delete()
              .eq("id", comment.id)
              .eq("author_id", user.id);

            if (deleteError) {
              alert("Couldn't delete your comment.");
              deleteButton.disabled = false;
              return;
            }

            await loadComments();
          });

          item.append(deleteButton);
        }

        list.append(item);
      }

      const input = make("textarea");
      input.maxLength = 1000;
      input.rows = 3;
      input.placeholder = "Leave a little bookish love... 💌";
      input.setAttribute("aria-label", "Write a comment");
      input.style.cssText =
        "width:100%;padding:12px;border:2px solid #edb4d0;" +
        "border-radius:12px;background:#fff9fc;resize:vertical;";

      const submit = make("button", "btn", "Post Comment 💌");
      submit.type = "button";

      submit.addEventListener("click", async () => {
        const content = input.value.trim();
        if (!content) return;

        submit.disabled = true;

        const { error: insertError } = await client
          .from("commons_post_comments")
          .insert({
            post_id: post.id,
            author_id: user.id,
            content
          });

        if (insertError) {
          console.error("Publish comment:", insertError);
          alert("Couldn't publish your comment.");
          submit.disabled = false;
          return;
        }

        await loadComments();
      });

      panel.replaceChildren(list, input, submit);
    }

    toggle.addEventListener("click", async () => {
      const opening = panel.hidden;

      panel.hidden = !opening;
      toggle.setAttribute("aria-expanded", String(opening));

      if (opening) {
        await loadComments();
      }
    });

    section.append(toggle, panel);
    article.append(section);
  }

  window.BB_COMMONS_COMMENTS = { addComments };
})();
