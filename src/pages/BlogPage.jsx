import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { fallbackPosts } from "../data/fallbackPosts";
import { formatDate, sortPosts } from "../lib/format";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const filters = [
  { label: "Daily Tidbits", value: "daily" },
  { label: "Books", value: "books" },
];

export default function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState(() => (isSupabaseConfigured ? [] : fallbackPosts));
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);

  const activeFilter = searchParams.get("category") || "daily";
  const activePosts = sortPosts(posts.filter((post) => post.category === activeFilter));
  const selectedSlug = searchParams.get("post");
  const selectedPost = selectedSlug
    ? activePosts.find((post) => post.slug === selectedSlug) || null
    : isMobile
      ? null
      : activePosts[0] || null;

  useEffect(() => {
    async function loadPosts() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (data?.length) {
        setPosts(sortPosts(data));
      }

      setLoading(false);
    }

    loadPosts();
  }, []);

  useEffect(() => {
    if (isMobile) {
      return;
    }

    if (!selectedPost && posts.length > 0) {
      const fallbackPost =
        sortPosts(posts).find((post) => post.category === activeFilter) || sortPosts(posts)[0];

      setSearchParams({
        category: fallbackPost.category,
        post: fallbackPost.slug,
      });
    }
  }, [activeFilter, isMobile, posts, selectedPost, setSearchParams]);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 1024);
    }

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleFilterChange(nextFilter) {
    const nextPosts = sortPosts(posts.filter((post) => post.category === nextFilter));
    const nextPost = nextPosts[0];

    if (!nextPost || isMobile) {
      setSearchParams({ category: nextFilter });
      return;
    }

    setSearchParams({
      category: nextFilter,
      post: nextPost.slug,
    });
  }

  function handlePostSelect(post) {
    setSearchParams({
      category: post.category,
      post: post.slug,
    });
  }

  return (
    <main className="paper-shell paper-grid text-ink">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[minmax(355px,42vw)_1fr]">
        <aside
          className={`flex min-h-screen flex-col border-b border-[#cfc2a4] lg:border-b-0 lg:border-r ${
            isMobile && selectedPost ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="grid grid-cols-2 border-b border-[#cfc2a4]">
            {filters.map((filter) => {
              const active = filter.value === activeFilter;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => handleFilterChange(filter.value)}
                  className={`min-h-[138px] px-8 py-6 text-[1.02rem] font-semibold leading-[1.9] transition ${
                    filter.value === "books" ? "text-right" : "text-left"
                  } ${
                    active ? "text-ink" : "text-[#d1c5a8]"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="blog-scroll flex-1 overflow-y-auto">
            <div className="py-4">
              {loading && (
                <div className="px-8 py-8 text-base text-[#a89d83]">
                  Loading posts...
                </div>
              )}

              {!loading && activePosts.length === 0 && (
                <div className="px-8 py-8 text-base text-[#a89d83]">
                  No posts in this section yet.
                </div>
              )}

              {activePosts.map((post) => {
                const isActive = selectedPost?.id === post.id;

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => handlePostSelect(post)}
                    className={`post-row ${isActive ? "post-row-active" : "text-[#b7ac93]"}`}
                  >
                    <span className="pr-4 text-[1.02rem] leading-[1.9]">
                      {post.title}
                    </span>
                    <span className="pt-0.5 text-[0.98rem] font-medium leading-[1.9] text-[#b9ae95]">
                      {post.pinned ? "Pinned · " : ""}
                      {formatDate(post.published_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <footer className="grid grid-cols-[1fr_auto] border-t border-[#cfc2a4]">
            <div className="px-8 py-5 text-[1.02rem] font-semibold leading-[1.9] text-[#d1c5a8]">
              Ivy&apos;s Sandbox
            </div>
            <div className="border-l border-[#cfc2a4] px-8 py-5 text-[1.02rem] font-medium leading-[1.9] text-[#b9ae95]">
              Last updated {formatDate(selectedPost?.updated_at || selectedPost?.published_at)}
            </div>
          </footer>
        </aside>

        <section
          className={`min-h-screen flex-col ${
            isMobile && !selectedPost ? "hidden lg:flex" : "flex"
          } blog-scroll lg:h-screen lg:overflow-y-auto`}
        >
          <header className="grid min-h-[72px] grid-cols-[1fr_auto] items-start px-8 pt-3 sm:min-h-[138px] sm:pt-6 sm:px-10">
            <div />
            <div />
          </header>

          <div className="flex-1">
            {selectedPost ? (
              <article className="min-h-full px-8 py-3 sm:px-10 sm:py-8 lg:px-12 lg:py-10">
                <div className="max-w-[980px]">
                  <h1 className="text-[1.18rem] font-semibold leading-[1.7] text-ink">
                    {selectedPost.title}
                  </h1>
                  <p className="mt-5 text-[1.02rem] font-medium leading-[1.9] text-[#b9ae95]">
                    {selectedPost.pinned ? "Pinned · " : ""}
                    {formatDate(selectedPost.published_at)}
                  </p>
                  {selectedPost.excerpt ? (
                    <blockquote className="mt-12 max-w-[980px] border-l-[7px] border-[#ece1c6] pl-7 text-[1.05rem] leading-[1.95] text-[#888073]">
                      {selectedPost.excerpt}
                    </blockquote>
                  ) : null}

                  <div className="mt-12 max-w-[980px]">
                    <MarkdownRenderer content={selectedPost.content} />
                  </div>
                  {error ? <div className="mt-12 text-sm text-rose-500">{error}</div> : null}
                </div>
              </article>
            ) : (
              <div className="flex h-full min-h-[60vh] items-center justify-center px-8 text-[#b9ae95]">
                {isMobile ? (
                  <span>Select a post from the list.</span>
                ) : (
                  <>
                    Add your first post in <Link to="/admin" className="ml-1 underline">/admin</Link>.
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
