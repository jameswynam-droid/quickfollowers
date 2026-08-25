import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen } from "lucide-react";

interface Post {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category_slug: string | null;
  published_at: string | null;
}
interface Category { slug: string; name: string; description: string | null; sort_order: number; }

const Help = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  useEffect(() => {
    document.title = "Help Center & Blog | QuickFollowers";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Guides, tutorials, and answers for placing SMM orders, Instagram, TikTok, YouTube and more.');

    (async () => {
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from("blog_posts").select("slug,title,excerpt,cover_image_url,category_slug,published_at").eq("published", true).order("published_at", { ascending: false }),
        supabase.from("blog_categories").select("*").order("sort_order"),
      ]);
      setPosts(p || []);
      setCats(c || []);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = posts;
    if (activeCat !== "all") {
      list = list.filter(p => (p.category_slugs?.length ? p.category_slugs : [p.category_slug]).includes(activeCat));
    }
    const s = q.trim().toLowerCase();
    if (!s) return list;

    const scored = list
      .map(p => ({ p, score: fuzzyScore(s, `${p.title} ${p.excerpt || ""} ${(p.category_slugs || []).join(" ")}`.toLowerCase()) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(x => x.p);
  }, [posts, q, activeCat]);


  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <BookOpen className="h-10 w-10 mx-auto mb-3 text-primary" />
          <h1 className="text-3xl sm:text-5xl font-bold mb-2">Help Center & Blog</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">Step-by-step guides showing exactly where to find your profile links, video URLs and more.</p>
        </div>

        <div className="relative max-w-xl mx-auto mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles..." className="pl-9" />
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-8">
          <Badge variant={activeCat === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setActiveCat("all")}>All</Badge>
          {cats.map(c => (
            <Badge key={c.slug} variant={activeCat === c.slug ? "default" : "outline"} className="cursor-pointer" onClick={() => setActiveCat(c.slug)}>{c.name}</Badge>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">No articles yet. Check back soon.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(p => (
              <Link key={p.slug} to={`/help/${p.slug}`}>
                <Card className="hover:shadow-lg transition h-full overflow-hidden">
                  {p.cover_image_url && (
                    <div className="aspect-video bg-muted overflow-hidden">
                      <img src={p.cover_image_url} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-2">
                    {p.category_slug && <Badge variant="secondary" className="text-xs">{cats.find(c => c.slug === p.category_slug)?.name || p.category_slug}</Badge>}
                    <h2 className="font-semibold leading-tight">{p.title}</h2>
                    {p.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Help;
