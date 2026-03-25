import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { fallbackPosts } from "../data/fallbackPosts";
import {
  formatDate,
  getLocalDateInputValue,
  makeSlug,
  sortPosts,
  toStoredLocalDate,
} from "../lib/format";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const emptyForm = {
  id: "",
  title: "",
  slug: "",
  excerpt: "",
  category: "daily",
  pinned: false,
  content: "",
  published: true,
  published_at: getLocalDateInputValue(),
};

const starterMarkdown = `> TL;DR add the thought before it disappears

## Opening thought

Write something worth returning to.

\`\`\`js
function hello() {
  return "code blocks work here";
}
\`\`\`
`;

const ADMIN_DRAFT_KEY = "ivy-sandbox-admin-draft";
const ADMIN_LAST_POST_KEY = "ivy-sandbox-admin-last-post";
const ADMIN_LAST_PANE_KEY = "ivy-sandbox-admin-last-pane";

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [posts, setPosts] = useState(() => (isSupabaseConfigured ? [] : fallbackPosts));
  const [form, setForm] = useState({ ...emptyForm, content: starterMarkdown });
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activePane, setActivePane] = useState(() => {
    return searchParams.get("pane") || window.sessionStorage.getItem(ADMIN_LAST_PANE_KEY) || "editor";
  });
  const textareaRef = useRef(null);

  function syncAdminParams({ postSlug, pane }) {
    const next = new URLSearchParams(searchParams);

    if (postSlug) {
      next.set("post", postSlug);
    } else {
      next.delete("post");
    }

    if (pane === "preview") {
      next.set("pane", "preview");
    } else {
      next.delete("pane");
    }

    setSearchParams(next);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingAuth(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session ?? null);
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !isSupabaseConfigured) {
      return;
    }

    loadPosts();
  }, [session]);

  useEffect(() => {
    const draft = window.sessionStorage.getItem(ADMIN_DRAFT_KEY);

    if (!draft) {
      return;
    }

    try {
      const parsed = JSON.parse(draft);

      if (parsed?.mode === "new" && !searchParams.get("post")) {
        setSelectedId("");
        setForm({
          ...emptyForm,
          ...parsed.form,
          published_at: parsed.form?.published_at || getLocalDateInputValue(),
        });
      }
    } catch {
      window.sessionStorage.removeItem(ADMIN_DRAFT_KEY);
    }
  }, [searchParams]);

  useEffect(() => {
    window.sessionStorage.setItem(ADMIN_LAST_PANE_KEY, activePane);
    syncAdminParams({
      postSlug: searchParams.get("post"),
      pane: activePane,
    });
  }, [activePane]);

  async function loadPosts(options = {}) {
    const { selectFirst = false } = options;
    const { data, error: fetchError } = await supabase
      .from("posts")
      .select("*")
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      return [];
    }

    const sortedPosts = sortPosts(data || []);
    setPosts(sortedPosts);

    const savedDraft = window.sessionStorage.getItem(ADMIN_DRAFT_KEY);
    let hasNewDraft = false;

    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        hasNewDraft = parsedDraft?.mode === "new";
      } catch {
        window.sessionStorage.removeItem(ADMIN_DRAFT_KEY);
      }
    }

    const requestedSlug = searchParams.get("post")
      || (hasNewDraft ? null : window.sessionStorage.getItem(ADMIN_LAST_POST_KEY));
    const requestedPost = requestedSlug
      ? sortedPosts.find((post) => post.slug === requestedSlug)
      : null;

    if (requestedPost) {
      selectPost(requestedPost, { syncUrl: false });
      return sortedPosts;
    }

    if (hasNewDraft && !searchParams.get("post")) {
      return sortedPosts;
    }

    if (sortedPosts.length && (selectFirst || (!selectedId && !requestedSlug))) {
      selectPost(sortedPosts[0]);
    }

    return sortedPosts;
  }

  function selectPost(post, options = {}) {
    const { syncUrl = true } = options;

    setSelectedId(post.id);
    setForm({
      id: post.id,
      title: post.title || "",
      slug: post.slug || "",
      excerpt: post.excerpt || "",
      category: post.category || "daily",
      pinned: Boolean(post.pinned),
      content: post.content || "",
      published: Boolean(post.published),
      published_at: post.published_at ? getLocalDateInputValue(post.published_at) : "",
    });
    setStatus("");
    setError("");

    window.sessionStorage.setItem(ADMIN_LAST_POST_KEY, post.slug);
    window.sessionStorage.removeItem(ADMIN_DRAFT_KEY);

    if (syncUrl) {
      syncAdminParams({
        postSlug: post.slug,
        pane: activePane,
      });
    }
  }

  function resetForm() {
    setSelectedId("");
    const nextForm = {
      ...emptyForm,
      content: starterMarkdown,
      published_at: getLocalDateInputValue(),
    };

    setForm(nextForm);
    setStatus("");
    setError("");

    window.sessionStorage.removeItem(ADMIN_LAST_POST_KEY);
    window.sessionStorage.setItem(
      ADMIN_DRAFT_KEY,
      JSON.stringify({
        mode: "new",
        form: nextForm,
      }),
    );

    syncAdminParams({
      postSlug: null,
      pane: activePane,
    });
  }

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "title" && (!current.slug || current.slug === makeSlug(current.title))) {
        next.slug = makeSlug(value);
      }

      if (!selectedId) {
        window.sessionStorage.setItem(
          ADMIN_DRAFT_KEY,
          JSON.stringify({
            mode: "new",
            form: next,
          }),
        );
      }

      return next;
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setStatus("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setStatus("Signed in.");
    setEmail("");
    setPassword("");
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    const payload = {
      author_id: session.user.id,
      title: form.title.trim(),
      slug: makeSlug(form.slug || form.title),
      excerpt: form.excerpt.trim(),
      category: form.category,
      pinned: form.pinned,
      content: form.content,
      published: form.published,
      published_at: toStoredLocalDate(form.published_at) || new Date().toISOString(),
    };

    if (!payload.title || !payload.slug || !payload.content.trim()) {
      setSaving(false);
      setError("Title, slug, and content are required.");
      return;
    }

    const query = selectedId
      ? supabase.from("posts").update(payload).eq("id", selectedId).select().single()
      : supabase.from("posts").insert(payload).select().single();

    const { data, error: saveError } = await query;

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setStatus(selectedId ? "Post updated." : "Post created.");
    await loadPosts();
    selectPost(data);
  }

  async function handleDelete() {
    if (!selectedId) {
      return;
    }

    const confirmed = window.confirm("Delete this post permanently?");

    if (!confirmed) {
      return;
    }

    setError("");
    setStatus("");

    const { error: deleteError } = await supabase.from("posts").delete().eq("id", selectedId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSelectedId("");
    window.sessionStorage.removeItem(ADMIN_LAST_POST_KEY);
    const refreshedPosts = await loadPosts({ selectFirst: true });

    if (!refreshedPosts.length) {
      resetForm();
    }

    setStatus("Post deleted.");
  }

  async function handleUploadImage(event) {
    const file = event.target.files?.[0];

    if (!file || !session?.user) {
      return;
    }

    setUploading(true);
    setError("");
    setStatus("");

    const extension = file.name.split(".").pop();
    const path = `${session.user.id}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("post-images").getPublicUrl(path);

    insertAtCursor(`![${file.name}](${publicUrl})`);
    setUploading(false);
    setStatus("Image uploaded and inserted.");
    event.target.value = "";
  }

  function insertAtCursor(snippet) {
    const textarea = textareaRef.current;

    if (!textarea) {
      updateField("content", `${form.content}\n${snippet}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = form.content.slice(0, start) + snippet + form.content.slice(end);

    updateField("content", next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
    setPosts(fallbackPosts);
    window.sessionStorage.removeItem(ADMIN_DRAFT_KEY);
    window.sessionStorage.removeItem(ADMIN_LAST_POST_KEY);
    window.sessionStorage.removeItem(ADMIN_LAST_PANE_KEY);
    resetForm();
  }

  const groupedPosts = {
    daily: sortPosts(posts.filter((post) => post.category === "daily")),
    books: sortPosts(posts.filter((post) => post.category === "books")),
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="paper-shell text-ink">
        <div className="grid min-h-screen lg:grid-cols-[minmax(355px,42vw)_1fr]">
          <aside className="flex min-h-screen flex-col border-b border-[#cfc2a4] lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-2 border-b border-[#cfc2a4]">
              <div className="min-h-[138px] px-8 py-6 text-[1.02rem] font-semibold leading-[1.9] text-ink">
                Admin
              </div>
              <div className="min-h-[138px] px-8 py-6 text-[1.02rem] font-semibold leading-[1.9] text-[#d1c5a8]">
                Setup
              </div>
            </div>
            <div className="flex-1 px-8 py-8 text-[1.03rem] leading-[1.95] text-[#a89d83]">
              Add your project URL and publishable key to <code>.env</code>, then run the SQL schema.
            </div>
            <footer className="grid grid-cols-[1fr_auto] items-center border-t border-[#cfc2a4]">
              <Link to="/" className="px-8 py-5 text-[1.02rem] font-medium text-[#b9ae95] hover:text-ink">
                Back to blog
              </Link>
              <div className="border-l border-[#cfc2a4] px-8 py-5 text-[0.98rem] text-[#b9ae95]">
                Supabase required
              </div>
            </footer>
          </aside>

          <section className="flex min-h-screen flex-col">
            <header className="grid min-h-[138px] grid-cols-[1fr_auto] items-start border-b border-[#cfc2a4] px-8 pt-6 sm:px-10">
              <div />
              <div className="text-right text-[1.02rem] font-semibold leading-[1.9] text-[#d1c5a8]">
                Ivy&apos;s Sandbox
              </div>
            </header>
            <div className="px-8 py-10 sm:px-10 lg:px-12">
              <pre className="overflow-x-auto border border-[#cfc2a4] bg-transparent p-6 text-sm text-ink">
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key`}
              </pre>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (loadingAuth) {
    return (
      <main className="paper-shell flex min-h-screen items-center justify-center text-[#a89d83]">
        Checking your admin session...
      </main>
    );
  }

  if (!session) {
    return (
      <main className="paper-shell text-ink">
        <div className="grid min-h-screen lg:grid-cols-[minmax(355px,42vw)_1fr]">
          <aside className="flex min-h-screen flex-col border-b border-[#cfc2a4] lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-2 border-b border-[#cfc2a4]">
              <div className="min-h-[138px] px-8 py-6 text-[1.02rem] font-semibold leading-[1.9] text-ink">
                Admin
              </div>
              <div className="min-h-[138px] px-8 py-6 text-[1.02rem] font-semibold leading-[1.9] text-[#d1c5a8]">
                Sign in
              </div>
            </div>

            <div className="flex-1 px-8 py-8 text-[1.03rem] leading-[1.95] text-[#a89d83]">
              This editor uses Supabase Auth, storage-backed images, and row-level security so only your account can create, edit, and delete posts.
            </div>

            <footer className="grid grid-cols-[1fr_auto] items-center border-t border-[#cfc2a4]">
              <Link to="/" className="px-8 py-5 text-[1.02rem] font-medium text-[#b9ae95] hover:text-ink">
                Back to blog
              </Link>
              <div className="border-l border-[#cfc2a4] px-8 py-5 text-[0.98rem] text-[#b9ae95]">
                Secure login
              </div>
            </footer>
          </aside>

          <section className="flex min-h-screen flex-col">
            <header className="grid min-h-[138px] grid-cols-[1fr_auto] items-start border-b border-[#cfc2a4] px-8 pt-6 sm:px-10">
              <div />
              <div className="text-right text-[1.02rem] font-semibold leading-[1.9] text-[#d1c5a8]">
                Ivy&apos;s Sandbox
              </div>
            </header>

            <form onSubmit={handleLogin} className="max-w-[760px] px-8 py-10 sm:px-10 lg:px-12">
              <div className="grid gap-5 border-b border-[#cfc2a4] pb-8 md:grid-cols-2">
                <label className="block">
                  <span className="mono-label mb-3 block text-[0.82rem] uppercase text-[#b9ae95]">
                    Email
                  </span>
                  <input
                    type="email"
                    className="field h-12"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mono-label mb-3 block text-[0.82rem] uppercase text-[#b9ae95]">
                    Password
                  </span>
                  <input
                    type="password"
                    className="field h-12"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-6">
                <button type="submit" className="button-secondary">
                  Sign in
                </button>
                {error ? <span className="text-sm text-rose-600">{error}</span> : null}
                {status ? <span className="text-sm text-emerald-700">{status}</span> : null}
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="paper-shell text-ink">
      <div className="grid min-h-screen lg:grid-cols-[minmax(355px,42vw)_1fr]">
        <aside className="flex min-h-screen flex-col border-b border-[#cfc2a4] lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-2 border-b border-[#cfc2a4]">
            <button
              type="button"
              onClick={() => setActivePane("editor")}
              className={`min-h-[138px] px-8 py-6 text-left text-[1.02rem] font-semibold leading-[1.9] ${
                activePane === "editor" ? "text-ink" : "text-[#d1c5a8]"
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActivePane("preview")}
              className={`min-h-[138px] px-8 py-6 text-left text-[1.02rem] font-semibold leading-[1.9] ${
                activePane === "preview" ? "text-ink" : "text-[#d1c5a8]"
              }`}
            >
              Preview
            </button>
          </div>

          <div className="blog-scroll flex-1 overflow-y-auto">
            <div className="border-b border-[#cfc2a4] px-8 py-5">
              <button type="button" onClick={resetForm} className="text-[1rem] font-medium text-[#b9ae95] hover:text-ink">
                New post
              </button>
            </div>

            <div className="py-2">
              {groupedPosts.daily.length > 0 ? (
                <div className="px-8 pb-2 pt-4">
                  <div className="mono-label text-[0.82rem] uppercase text-[#c6bba0]">Daily Tidbits</div>
                </div>
              ) : null}
              {groupedPosts.daily.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => selectPost(post)}
                  className={`post-row ${selectedId === post.id ? "post-row-active" : "text-[#b7ac93]"}`}
                >
                  <span className="pr-4 text-[1.02rem] leading-[1.9]">{post.title}</span>
                  <span className="pt-0.5 text-[0.98rem] font-medium leading-[1.9] text-[#b9ae95]">
                    {post.pinned ? "Pinned · " : ""}
                    {formatDate(post.published_at)}
                  </span>
                </button>
              ))}

              {groupedPosts.books.length > 0 ? (
                <div className="px-8 pb-2 pt-8">
                  <div className="mono-label text-[0.82rem] uppercase text-[#c6bba0]">Books</div>
                </div>
              ) : null}
              {groupedPosts.books.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => selectPost(post)}
                  className={`post-row ${selectedId === post.id ? "post-row-active" : "text-[#b7ac93]"}`}
                >
                  <span className="pr-4 text-[1.02rem] leading-[1.9]">{post.title}</span>
                  <span className="pt-0.5 text-[0.98rem] font-medium leading-[1.9] text-[#b9ae95]">
                    {post.pinned ? "Pinned · " : ""}
                    {formatDate(post.published_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <footer className="grid grid-cols-[1fr_auto] items-center border-t border-[#cfc2a4]">
            <button
              type="button"
              onClick={handleSignOut}
              className="px-8 py-5 text-left text-[1.02rem] font-medium text-[#b9ae95] hover:text-ink"
            >
              Sign out
            </button>
            <div className="border-l border-[#cfc2a4] px-8 py-5 text-[0.98rem] text-[#b9ae95]">
              {selectedId ? "Editing post" : "Drafting"}
            </div>
          </footer>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="grid min-h-[138px] grid-cols-[1fr_auto] items-start border-b border-[#cfc2a4] px-8 pt-6 sm:px-10">
            <div className="flex flex-wrap items-center gap-4 text-sm text-[#b9ae95]">
              <button type="button" onClick={handleSave} className="hover:text-ink" disabled={saving}>
                {saving ? "Saving..." : selectedId ? "Update" : "Publish"}
              </button>
              {selectedId ? (
                <button type="button" onClick={handleDelete} className="hover:text-ink">
                  Delete
                </button>
              ) : null}
              <label className="cursor-pointer hover:text-ink">
                {uploading ? "Uploading..." : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadImage}
                  disabled={uploading}
                />
              </label>
              <button type="button" onClick={() => insertAtCursor("\n```js\nconsole.log('hello');\n```\n")} className="hover:text-ink">
                Code block
              </button>
              <button type="button" onClick={() => insertAtCursor("`inline snippet`")} className="hover:text-ink">
                Inline code
              </button>
            </div>
            <div className="text-right">
              <div className="text-[1.02rem] font-semibold leading-[1.9] text-[#d1c5a8]">
                Ivy&apos;s Sandbox
              </div>
              <Link
                to="/"
                className="mt-4 inline-block text-sm font-medium text-[#b7ac93] underline-offset-4 transition hover:text-ink hover:underline"
              >
                /
              </Link>
            </div>
          </header>

          {activePane === "editor" ? (
            <form onSubmit={handleSave} className="blog-scroll flex-1 overflow-y-auto px-8 py-8 sm:px-10 lg:px-12">
              <div className="max-w-[980px]">
                <div className="grid gap-6 border-b border-[#cfc2a4] pb-7 md:grid-cols-[1.45fr_1fr]">
                  <label className="block">
                    <span className="mono-label mb-3 block text-[0.82rem] uppercase text-[#b9ae95]">
                      Title
                    </span>
                    <input
                      className="field h-12 text-[1rem]"
                      value={form.title}
                      onChange={(event) => updateField("title", event.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="mono-label mb-3 block text-[0.82rem] uppercase text-[#b9ae95]">
                      Slug
                    </span>
                    <input
                      className="field h-12 text-[1rem]"
                      value={form.slug}
                      onChange={(event) => updateField("slug", event.target.value)}
                    />
                  </label>
                </div>

                <div className="grid gap-6 border-b border-[#cfc2a4] py-7 md:grid-cols-[170px_1fr_160px]">
                  <label className="block">
                    <span className="mono-label mb-3 block text-[0.82rem] uppercase text-[#b9ae95]">
                      Category
                    </span>
                    <select
                      className="field h-12"
                      value={form.category}
                      onChange={(event) => updateField("category", event.target.value)}
                    >
                      <option value="daily">Daily Tidbits</option>
                      <option value="books">Books</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mono-label mb-3 block text-[0.82rem] uppercase text-[#b9ae95]">
                      Excerpt
                    </span>
                    <input
                      className="field h-12 text-[1rem]"
                      value={form.excerpt}
                      onChange={(event) => updateField("excerpt", event.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="mono-label mb-3 block text-[0.82rem] uppercase text-[#b9ae95]">
                      Date
                    </span>
                    <input
                      type="date"
                      className="field h-12"
                      value={form.published_at}
                      onChange={(event) => updateField("published_at", event.target.value)}
                    />
                  </label>
                </div>

                <div className="grid gap-6 border-b border-[#cfc2a4] py-7 md:grid-cols-[170px_170px_1fr]">
                  <label className="block">
                    <span className="mono-label mb-3 block text-[0.82rem] uppercase text-[#b9ae95]">
                      Status
                    </span>
                    <select
                      className="field h-12"
                      value={form.published ? "published" : "draft"}
                      onChange={(event) => updateField("published", event.target.value === "published")}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mono-label mb-3 block text-[0.82rem] uppercase text-[#b9ae95]">
                      Pin
                    </span>
                    <select
                      className="field h-12"
                      value={form.pinned ? "pinned" : "normal"}
                      onChange={(event) => updateField("pinned", event.target.value === "pinned")}
                    >
                      <option value="normal">Normal</option>
                      <option value="pinned">Pinned</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap items-end gap-3 pb-1">
                    <button type="button" className="chip" onClick={() => insertAtCursor("\n## New section\n")}>
                      Heading
                    </button>
                    <button type="button" className="chip" onClick={() => insertAtCursor("\n> Pull quote\n")}>
                      Quote
                    </button>
                    <button type="button" className="chip" onClick={() => insertAtCursor("\n- First point\n- Second point\n")}>
                      List
                    </button>
                  </div>
                </div>

                <div className="pt-7">
                  <div className="mono-label mb-4 text-[0.82rem] uppercase text-[#b9ae95]">
                    Markdown
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="field editor-textarea w-full"
                    value={form.content}
                    onChange={(event) => updateField("content", event.target.value)}
                  />
                </div>

                {(error || status) ? (
                  <div className="pt-5 text-sm">
                    {error ? <span className="text-rose-600">{error}</span> : null}
                    {status ? <span className="text-emerald-700">{status}</span> : null}
                  </div>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="blog-scroll flex-1 overflow-y-auto px-8 py-10 sm:px-10 lg:px-12">
              <article className="max-w-[980px]">
                <h1 className="text-[clamp(2.1rem,2.5vw,3rem)] font-semibold tracking-[-0.04em] text-ink">
                  {form.title || "Untitled post"}
                </h1>
                <p className="mt-5 text-[1.02rem] font-medium leading-[1.9] text-[#b9ae95]">
                  {form.pinned ? "Pinned · " : ""}
                  {formatDate(form.published_at)} · {form.category === "books" ? "Books" : "Daily Tidbits"}
                </p>
                {form.excerpt ? (
                  <blockquote className="mt-12 max-w-[980px] border-l-[7px] border-[#ece1c6] pl-7 text-[1.05rem] leading-[1.95] text-[#888073]">
                    {form.excerpt}
                  </blockquote>
                ) : null}
                <div className="mt-12">
                  <MarkdownRenderer content={form.content} />
                </div>
                {(error || status) ? (
                  <div className="pt-8 text-sm">
                    {error ? <span className="text-rose-600">{error}</span> : null}
                    {status ? <span className="text-emerald-700">{status}</span> : null}
                  </div>
                ) : null}
              </article>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
