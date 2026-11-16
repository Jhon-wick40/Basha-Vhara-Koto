import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Phone, Copy, History, Receipt, MapPinned, Camera, Trash2 } from "lucide-react";

export default function Profile() {
  const { user, profile, role, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAvatarUrl(profile.avatar_url || "");
      setBio(profile.bio || "");
      setBusinessName(profile.business_name || "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim().slice(0, 100),
      phone: phone.trim().slice(0, 30) || null,
      avatar_url: avatarUrl.trim() || null,
      bio: bio.trim().slice(0, 500) || null,
      business_name: businessName.trim().slice(0, 100) || null,
    }).eq("id", user.id);
    
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); await refreshProfile(); }
    setSaving(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP, or GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be under 5 MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/${Date.now()}_avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, cacheControl: "3600" });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = data?.publicUrl;

      if (publicUrl) {
        setAvatarUrl(publicUrl);
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", user.id);

        if (updateError) throw updateError;

        await refreshProfile();
        toast.success("Profile photo updated successfully");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload profile photo";
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    setUploadingPhoto(true);
    try {
      setAvatarUrl("");
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success("Profile photo removed");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove profile photo";
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (!profile) return <div className="container py-20 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="font-display text-3xl font-bold mb-6">Your Profile</h1>
      <Card className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative group">
            <Avatar className="h-20 w-20 border-2 border-border shadow-sm">
              <AvatarImage src={avatarUrl} alt={fullName || "Profile"} className="object-cover" />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {fullName?.[0] ?? "U"}
              </AvatarFallback>
            </Avatar>
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto || saving}
              className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-2 rounded-full shadow-md hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-50 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              title="Upload profile photo"
              aria-label="Upload profile photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto || saving}
            />
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="font-semibold text-lg truncate">{fullName || user?.email}</h2>
              {role && (
                <Badge variant="outline" className="text-[11px] uppercase tracking-wider text-primary border-primary/30">
                  {role}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs min-h-[36px]"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto || saving}
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                )}
                {avatarUrl ? "Change photo" : "Upload photo"}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs min-h-[36px] text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto || saving}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* User IDs Section (Both Custom UID & Supabase UUID) */}
        <div className="space-y-3">
          <div className="rounded-md border bg-primary/5 border-primary/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] uppercase tracking-wider font-semibold text-primary">
                Custom User ID (Shareable)
              </Label>
              <span className="text-[10px] text-muted-foreground">Easy to share</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 text-sm font-bold font-mono tracking-wide text-foreground">
                {profile.custom_uid || "Not assigned yet"}
              </code>
              {profile.custom_uid ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => copyText(profile.custom_uid!, "Custom User ID")}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground italic">Admin can assign your custom UID</span>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Supabase System UUID
              </Label>
              <span className="text-[10px] text-muted-foreground">Technical ID</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 text-xs break-all font-mono text-muted-foreground">{user?.id}</code>
              <Button type="button" size="sm" variant="outline" onClick={() => copyText(user?.id || "", "UUID")}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
            </div>
          </div>
        </div>

        {/* Residential Journey (New Option for Tenants) */}
        {role === "tenant" && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button asChild variant="outline" className="h-auto py-4 flex flex-col items-center gap-1 hover:border-primary hover:bg-primary/5">
              <Link to="/history">
                <Receipt className="h-5 w-5 text-primary" />
                <span className="font-medium text-xs">Rent History</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex flex-col items-center gap-1 hover:border-primary hover:bg-primary/5">
              <Link to="/tenant/life-cycle">
                <MapPinned className="h-5 w-5 text-primary" />
                <span className="font-medium text-xs">Life Cycle</span>
              </Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/kyc"><ShieldCheck className="h-4 w-4 mr-2" /> KYC verification</Link>
          </Button>
          {role === "landlord" && (
            <Button asChild variant="outline" size="sm">
              <Link to="/tenant-lookup"><History className="h-4 w-4 mr-2" /> Look up tenant</Link>
            </Button>
          )}
        </div>

        <div className="space-y-4 border-t pt-5">
          <div><Label>Full name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+880..." /></div>
          <div>
            <Label>Photo URL (auto-filled on upload)</Label>
            <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </div>
          {role === "landlord" && (
            <div><Label>Business name (optional)</Label><Input value={businessName} onChange={e => setBusinessName(e.target.value)} /></div>
          )}
          <div><Label>Bio</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} /></div>
          <Button onClick={save} className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save changes
          </Button>
        </div>
      </Card>
    </div>
  );
}