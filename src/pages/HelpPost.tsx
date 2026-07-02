import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import FullPageLoader from "@/components/FullPageLoader";

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

// Very small markdown renderer covering headings, bold, italic, lists, images, links, and paragraphs.
function renderMd(md: string): string {
  const esc = (s: string) => s.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]!));
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  const inline = (s: string) => esc(s)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" class="rounded-lg my-4 max-w-full h-auto border" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" rel="noreferrer noopener" target="_blank">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-xs">$1</code>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) { if (!inUl) { out.push('<ul class="list-disc pl-6 space-y-1 my-3">'); inUl = true; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (!line) continue;
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { const n = h[1].length; const sz = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg'][n - 1]; out.push(`<h${n} class="${sz} font-bold mt-6 mb-2">${inline(h[2])}</h${n}>`); continue; }
    out.push(`<p class="my-3 leading-relaxed">${inline(line)}</p>`);
  }
  if (inUl) out.push('</ul>');
  return out.join('\n');
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
        // JSON-LD
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
          {post.cover_image_url && <img src={post.cover_image_url} alt={post.title} className="w-full rounded-lg mb-6 border" />}
          <div className="text-foreground" dangerouslySetInnerHTML={{ __html: renderMd(post.body_md) }} />
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default HelpPost;
