import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageSquareText, Search, Send, X } from "lucide-react";

interface Reply { id: string; title: string; body: string; category: string | null; }

interface Props {
  onSend: (text: string) => void | Promise<void>;
}

/**
 * Inline saved-replies picker for the admin ticket chat.
 * - Support agent searches by title
 * - Taps a reply to load it into an editable box
 * - Edits blanks (e.g. "___") then taps Send
 */
const SavedRepliesPicker = ({ onSend }: Props) => {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [q, setQ] = useState("");
  const [drafting, setDrafting] = useState<string | null>(null);

  useEffect(() => {
    if (!open || replies.length) return;
    supabase.from("saved_replies").select("*").order("title").then(({ data }) => setReplies((data as Reply[]) || []));
  }, [open, replies.length]);

  const filtered = replies.filter(r => {
    const s = q.toLowerCase().trim();
    if (!s) return true;
    return r.title.toLowerCase().includes(s) || r.body.toLowerCase().includes(s) || (r.category || "").toLowerCase().includes(s);
  });

  const send = async () => {
    if (!drafting?.trim()) return;
    await onSend(drafting.trim());
    setDrafting(null);
    setOpen(false);
    setQ("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" type="button" title="Saved replies">
          <MessageSquareText className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[92vw] sm:w-96 p-3" align="start" side="top">
        {drafting === null ? (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search saved replies..." className="pl-7 h-8 text-sm" autoFocus />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No saved replies match. Create some in Admin Panel → Saved Replies.</p>
              ) : filtered.map(r => (
                <button key={r.id} onClick={() => setDrafting(r.body)} className="w-full text-left p-2 rounded hover:bg-muted transition">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.body}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Edit blanks (___), then send</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDrafting(null)}><X className="h-3 w-3" /></Button>
            </div>
            <Textarea rows={6} value={drafting} onChange={e => setDrafting(e.target.value)} className="text-sm" autoFocus />
            <Button size="sm" className="w-full" onClick={send}><Send className="h-3.5 w-3.5 mr-1.5" /> Send reply</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default SavedRepliesPicker;
