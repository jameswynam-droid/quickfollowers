import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Edit } from "lucide-react";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  body_md: string;
  category_slug: string | null;
  published: boolean;
  seo_title: string | null;
  seo_description: string | null;
}
interface Cat { slug: string; name: string; }

const empty: Partial<Post> = { slug: "", title: "", excerpt: "", cover_image_url: "", body_md: "", category_slug: null, published: false, seo_title: "", seo_description: "" };

const BlogAdmin = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("blog_posts").select("*").order("created_at", { ascending: false }),
      supabase.from("blog_categories").select("slug,name").order("sort_order"),
    ]);
    setPosts((p as Post[]) || []);
    setCats((c as Cat[]) || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.title || !editing?.slug) { toast.error("Title and slug required"); return; }
    setSaving(true);
    try {
      const payload: any = {
        slug: editing.slug!.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        title: editing.title,
        excerpt: editing.excerpt || null,
        cover_image_url: editing.cover_image_url || null,
        body_md: editing.body_md || "",
        category_slug: editing.category_slug || null,
        published: !!editing.published,
        seo_title: editing.seo_title || null,
        seo_description: editing.seo_description || null,
      };
      if (payload.published) payload.published_at = new Date().toISOString();
      if (editing.id) {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blog_posts").insert(payload);
        if (error) throw error;
      }
      toast.success("Saved");
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  if (editing) return (
    <Card>
      <CardHeader><CardTitle>{editing.id ? "Edit Post" : "New Post"}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Title</Label><Input value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })} /></div>
          <div><Label>Slug (URL)</Label><Input value={editing.slug || ""} onChange={e => setEditing({ ...editing, slug: e.target.value })} placeholder="how-to-find-instagram-link" /></div>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={editing.category_slug || ""} onValueChange={v => setEditing({ ...editing, category_slug: v || null })}>
            <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
            <SelectContent>{cats.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Excerpt</Label><Textarea rows={2} value={editing.excerpt || ""} onChange={e => setEditing({ ...editing, excerpt: e.target.value })} /></div>
        <div><Label>Cover Image URL</Label><Input value={editing.cover_image_url || ""} onChange={e => setEditing({ ...editing, cover_image_url: e.target.value })} placeholder="https://..." /></div>
        <div><Label>Body (Markdown supports ## headings, **bold**, *italic*, - lists, [link](url), ![alt](image))</Label>
          <Textarea rows={16} value={editing.body_md || ""} onChange={e => setEditing({ ...editing, body_md: e.target.value })} className="font-mono text-xs" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>SEO Title</Label><Input value={editing.seo_title || ""} onChange={e => setEditing({ ...editing, seo_title: e.target.value })} /></div>
          <div><Label>SEO Description</Label><Input value={editing.seo_description || ""} onChange={e => setEditing({ ...editing, seo_description: e.target.value })} /></div>
        </div>
        <div className="flex items-center gap-2"><Switch checked={!!editing.published} onCheckedChange={v => setEditing({ ...editing, published: v })} /><Label>Published</Label></div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Blog / Help Posts</CardTitle>
        <Button size="sm" onClick={() => setEditing({ ...empty })}>New Post</Button>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? <p className="text-sm text-muted-foreground">No posts yet.</p> : (
          <div className="space-y-2">
            {posts.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 border rounded">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-medium truncate">{p.title}</span>{p.published ? <Badge>Live</Badge> : <Badge variant="outline">Draft</Badge>}</div>
                  <p className="text-xs text-muted-foreground truncate">/help/{p.slug}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Edit className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BlogAdmin;
