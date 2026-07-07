import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import FullPageLoader from "@/components/FullPageLoader";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Post {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  body_md: string;
  category_slug: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

const HelpPost = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase.from("blog_posts").select("*").eq("slug", slug).eq("published", true).maybeSingle();
      setPost(data as Post | null);
      setLoading(false);
      if (data) {
        document.title = `${data.seo_title || data.title} | QuickFollowers Help`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', data.seo_description || data.excerpt || data.title);
        const existing = document.getElementById('help-jsonld');
        if (existing) existing.remove();
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'help-jsonld';
        script.text = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: data.title,
          description: data.seo_description || data.excerpt,
          image: data.cover_image_url ? [data.cover_image_url] : undefined,
          datePublished: data.published_at,
          publisher: { "@type": "Organization", name: "QuickFollowers" },
        });
        document.head.appendChild(script);
      }
    })();
    return () => { const el = document.getElementById('help-jsonld'); if (el) el.remove(); };
  }, [slug]);

  if (loading) return <FullPageLoader message="Loading article..." />;
  if (!post) return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Article not found</h1>
        <Button onClick={() => navigate('/help')}>Back to Help Center</Button>
      </main>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/help" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Help Center
        </Link>
        <article>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{post.title}</h1>
          {post.excerpt && <p className="text-lg text-muted-foreground mb-6">{post.excerpt}</p>}
          {post.cover_image_url && (
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full rounded-lg mb-6 border"
              loading="eager"
            />
          )}
          <div className="prose prose-neutral dark:prose-invert max-w-none
                          prose-headings:font-bold prose-headings:text-foreground
                          prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h3:text-xl
                          prose-p:text-foreground prose-p:leading-relaxed
                          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                          prose-strong:text-foreground
                          prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
                          prose-pre:bg-muted prose-pre:border
                          prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
                          prose-img:rounded-lg prose-img:border prose-img:my-6
                          prose-ul:my-4 prose-ol:my-4
                          prose-li:text-foreground prose-li:my-1
                          prose-table:text-sm prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-td:border">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => <a {...props} target={props.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener" />,
                img: ({ node, ...props }) => <img {...props} loading="lazy" />,
              }}
            >
              {post.body_md}
            </ReactMarkdown>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default HelpPost;
