import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Edit } from "lucide-react";

interface Reply { id: string; title: string; body: string; category: string | null; }

const SavedRepliesAdmin = () => {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [editing, setEditing] = useState<Partial<Reply> | null>(null);

  const load = async () => {
    const { data } = await supabase.from("saved_replies").select("*").order("title");
    setReplies((data as Reply[]) || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.title || !editing?.body) return toast.error("Title and body required");
    const payload = { title: editing.title, body: editing.body, category: editing.category || null };
    const { error } = editing.id
      ? await supabase.from("saved_replies").update(payload).eq("id", editing.id)
      : await supabase.from("saved_replies").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("saved_replies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (editing) return (
    <Card>
      <CardHeader><CardTitle>{editing.id ? "Edit Reply" : "New Saved Reply"}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Title (used for search)</Label><Input value={editing.title || ""} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Order started" /></div>
        <div><Label>Category (optional)</Label><Input value={editing.category || ""} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="orders" /></div>
        <div><Label>Body — use blanks like ___ that you'll fill in when sending</Label>
          <Textarea rows={6} value={editing.body || ""} onChange={e => setEditing({ ...editing, body: e.target.value })} placeholder="Your order ID ___ has been started and will complete within ___ hours." />
        </div>
        <div className="flex gap-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Saved Replies</CardTitle>
        <Button size="sm" onClick={() => setEditing({ title: "", body: "", category: "" })}>New Reply</Button>
      </CardHeader>
      <CardContent>
        {replies.length === 0 ? <p className="text-sm text-muted-foreground">No saved replies yet. Create your first template for the support team.</p> : (
          <div className="space-y-2">
            {replies.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 border rounded">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.body}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Edit className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedRepliesAdmin;
