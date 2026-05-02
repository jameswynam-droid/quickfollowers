import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Plus, X } from "lucide-react";

interface DailyPopup {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  primary_button_label: string | null;
  primary_button_url: string | null;
  primary_button_color: string | null;
  secondary_button_label: string | null;
  secondary_button_url: string | null;
  secondary_button_color: string | null;
  is_active: boolean;
  created_at: string;
}

export function AdminDailyPopups() {
  const [popups, setPopups] = useState<DailyPopup[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pLabel, setPLabel] = useState("");
  const [pUrl, setPUrl] = useState("");
  const [pColor, setPColor] = useState("#3b82f6");
  const [sLabel, setSLabel] = useState("");
  const [sUrl, setSUrl] = useState("");
  const [sColor, setSColor] = useState("#7e22ce");
  const [isActive, setIsActive] = useState(true);

  const fetchPopups = async () => {
    const { data } = await supabase.from("daily_popups").select("*").order("created_at", { ascending: false });
    setPopups((data || []) as DailyPopup[]);
  };

  useEffect(() => { fetchPopups(); }, []);

  const reset = () => {
    setTitle(""); setMessage(""); setImageFile(null);
    setPLabel(""); setPUrl(""); setPColor("#3b82f6");
    setSLabel(""); setSUrl(""); setSColor("#7e22ce");
    setIsActive(true);
    setShowForm(false);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('popup-images').upload(filename, file, { upsert: false });
    if (error) { toast.error("Image upload failed"); return null; }
    const { data: { publicUrl } } = supabase.storage.from('popup-images').getPublicUrl(filename);
    return publicUrl;
  };

  const create = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setUploading(true);
    try {
      let uploadedUrl: string | null = null;
      if (imageFile) {
        uploadedUrl = await uploadImage(imageFile);
        if (!uploadedUrl) return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_popups").insert({
        title: title.trim(),
        message: message.trim(),
        image_url: uploadedUrl,
        primary_button_label: pLabel.trim() || null,
        primary_button_url: pUrl.trim() || null,
        primary_button_color: pLabel.trim() ? pColor : null,
        secondary_button_label: sLabel.trim() || null,
        secondary_button_url: sUrl.trim() || null,
        secondary_button_color: sLabel.trim() ? sColor : null,
        is_active: isActive,
        created_by: user?.id,
      });
      if (error) { toast.error("Could not create pop-up"); return; }
      toast.success("Pop-up created");
      reset();
      fetchPopups();
    } finally {
      setUploading(false);
    }
  };

  const toggle = async (id: string, value: boolean) => {
    await supabase.from("daily_popups").update({ is_active: value }).eq("id", id);
    fetchPopups();
  };

  const remove = async (id: string) => {
    await supabase.from("daily_popups").delete().eq("id", id);
    fetchPopups();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Daily Pop-ups</CardTitle>
          <CardDescription>Shown once per day on Dashboard & Homepage</CardDescription>
        </div>
        <Button size="sm" onClick={() => setShowForm(s => !s)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Image (optional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              {imageFile && (
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted rounded p-2">
                  <span className="truncate">{imageFile.name}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setImageFile(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div className="space-y-1.5"><Label>Primary button</Label><Input placeholder="Label" value={pLabel} onChange={(e) => setPLabel(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>URL</Label><Input placeholder="https:// or /path" value={pUrl} onChange={(e) => setPUrl(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Color</Label><Input type="color" value={pColor} onChange={(e) => setPColor(e.target.value)} className="h-10 p-1" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div className="space-y-1.5"><Label>Secondary button</Label><Input placeholder="Label" value={sLabel} onChange={(e) => setSLabel(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>URL</Label><Input placeholder="https:// or /path" value={sUrl} onChange={(e) => setSUrl(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Color</Label><Input type="color" value={sColor} onChange={(e) => setSColor(e.target.value)} className="h-10 p-1" /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={create}>Create</Button>
              <Button variant="outline" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {popups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No pop-ups yet</p>
          ) : popups.map(p => (
            <div key={p.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium truncate">{p.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.message}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {p.primary_button_label && (
                    <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: p.primary_button_color || "#3b82f6" }}>
                      {p.primary_button_label}
                    </span>
                  )}
                  {p.secondary_button_label && (
                    <span className="text-xs px-2 py-0.5 rounded border" style={{ borderColor: p.secondary_button_color || "#7e22ce", color: p.secondary_button_color || "#7e22ce" }}>
                      {p.secondary_button_label}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Switch checked={p.is_active} onCheckedChange={(v) => toggle(p.id, v)} />
                <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
