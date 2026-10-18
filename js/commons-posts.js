
(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);

  const make = (tag, className = "", text = "") => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  };

  const formatTime = value =>
    new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });

  async function startBulletin(client, user) {
    const postsRoot = $("#posts");
    const publishButton = $("#publishPost");
    const postInput = $("#postText");

    if (!postsRoot || !publishButton || !postInput) {
      console.error("Crown Commons Bulletin elements are missing.");
      return;
    }

    publishButton.textContent = "Post to the Bestie Bulletin 💌";

    async function loadPosts() {
      postsRoot.replaceChildren(
        make("p", "", "💗 Loading the Bestie Bulletin...")
      );

      const { data: posts, error } = await client
        .from("commons_posts")
        .select("id, author_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Bulletin loading error:", error);
        postsRoot.replaceChildren(
          make("p", "", "Couldn't load the Bulletin. Please try refreshing.")
        );
        return;
      }

      postsRoot.replaceChildren();

      if (!posts.length) {
        postsRoot.append(
          make("p", "", "💗 The Bulletin is waiting for its first Bestie post!")
        );
        return;
      }

      const authorIds = [...new Set(posts.map(post => post.author_id))];

      const { data: profiles, error: profileError } = await client
        .from("profiles")
        .select("id, display_name")
        .in("id", authorIds);

      if (profileError) {
        console.warn("Bulletin author names:", profileError);
      }

      const names = new Map(
        (profiles || []).map(profile => [
          profile.id,
          profile.display_name || "Bestie"
        ])
      );

      for (const post of posts) {
        const article = make("article", "post");
        const header = make("div", "post-top");
        const avatar = make("span", "post-avatar", "💋");
        const info = make("div");

        info.append(
          make(
            "div",
            "post-name",
            names.get(post.author_id) || "Campus Bestie"
          ),
          make("div", "post-time", formatTime(post.created_at))
        );

        header.append(avatar, info);

        article.append(
          header,
          make("p", "", post.content)
        );

        if (post.author_id === user.id) {
          const removeButton = make(
            "button",
            "reaction",
            "🗑️ Delete My Post"
          );

          removeButton.type = "button";

          removeButton.addEventListener("click", async () => {
            if (!confirm("Delete this post from Crown Commons?")) return;

            removeButton.disabled = true;

            const { error: deleteError } = await client
              .from("commons_posts")
              .delete()
              .eq("id", post.id)
              .eq("author_id", user.id);

            if (deleteError) {
              alert("Couldn't delete your post. Please try again.");
              removeButton.disabled = false;
              return;
            }

            await loadPosts();
          });

          article.append(removeButton);
        }

        postsRoot.append(article);
      }
    }

    publishButton.addEventListener("click", async () => {
      const content = postInput.value.trim();

      if (!content) return;

      if (content.length > 1000) {
        alert("Posts must be 1,000 characters or fewer.");
        return;
      }

      publishButton.disabled = true;
      publishButton.textContent = "Publishing... 💗";

      const { error } = await client
        .from("commons_posts")
        .insert({
          author_id: user.id,
          content
        });

      publishButton.disabled = false;
      publishButton.textContent = "Post to the Bestie Bulletin 💌";

      if (error) {
        console.error("Bulletin publishing error:", error);
        alert("Your post couldn't be published. Please try again.");
        return;
      }

      postInput.value = "";
      await loadPosts();
    });

    await loadPosts();
  }

  window.BB_COMMONS_POSTS = { startBulletin };
})();
