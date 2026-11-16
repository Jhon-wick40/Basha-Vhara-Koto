import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Users, Building2, ShieldCheck, ShieldAlert, ShieldX, 
  Search, RefreshCw, CheckCircle2, Eye, Trash2, 
  Copy, Shield, AlertTriangle, ExternalLink, Pencil, Plus, Bot, Sparkles, MessageSquare
} from "lucide-react";

interface ChatbotFaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
}

interface ProfileItem {
  id: string;
  custom_uid?: string;
  full_name: string;
  phone: string | null;
  role?: string;
  created_at?: string;
}

interface KycItem {
  id: string;
  user_id: string;
  nid_number: string | null;
  nid_front_url: string | null;
  nid_back_url: string | null;
  selfie_url: string | null;
  status: "pending" | "verified" | "rejected";
  notes: string | null;
  created_at: string;
  profile?: ProfileItem;
}

interface ListingItem {
  id: string;
  landlord_id: string;
  title: string;
  rent_amount: number;
  division?: string;
  district?: string;
  available: boolean;
  created_at: string;
}

export default function AdminDashboard() {
  const { user, role, refreshProfile } = useAuth();
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data lists
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [userRoles, setUserRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [kycList, setKycList] = useState<KycItem[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  
  // Search & Filter
  const [userSearch, setUserSearch] = useState("");
  const [listingSearch, setListingSearch] = useState("");
  const [kycFilter, setKycFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");
  
  // Custom UID Assignment Dialog
  const [editingUidUser, setEditingUidUser] = useState<ProfileItem | null>(null);
  const [newCustomUid, setNewCustomUid] = useState("");
  const [savingUid, setSavingUid] = useState(false);

  const openEditUid = (u: ProfileItem) => {
    setEditingUidUser(u);
    setNewCustomUid(u.custom_uid || "");
  };

  const handleSaveCustomUid = async () => {
    if (!editingUidUser) return;
    const trimmed = newCustomUid.trim();

    if (!trimmed) {
      toast.error("Custom UID cannot be empty. Enter a Custom ID or click 'Suggest ID'.");
      return;
    }

    if (trimmed.length < 2 || trimmed.length > 30) {
      toast.error("Custom UID must be between 2 and 30 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      toast.error("Custom UID can only contain letters, numbers, hyphens, and underscores (no spaces).");
      return;
    }

    setSavingUid(true);
    try {
      // Check if taken by another user (case-insensitive)
      const { data: existing, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .ilike("custom_uid", trimmed)
        .neq("id", editingUidUser.id)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) {
        toast.error(`Custom UID "${trimmed}" is already taken by another user.`);
        setSavingUid(false);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ custom_uid: trimmed })
        .eq("id", editingUidUser.id);

      if (error) throw error;

      toast.success(`Assigned Custom UID "${trimmed}"`);
      setProfiles(prev =>
        prev.map(p => (p.id === editingUidUser.id ? { ...p, custom_uid: trimmed } : p))
      );
      setEditingUidUser(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to update Custom UID: " + msg);
    } finally {
      setSavingUid(false);
    }
  };

  // KYC Document Preview Dialog
  const [selectedKyc, setSelectedKyc] = useState<KycItem | null>(null);
  const [kycSignedUrls, setKycSignedUrls] = useState<{ front?: string; back?: string; selfie?: string }>({});
  const [kycNotes, setKycNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Chatbot Q&A Management
  const [faqs, setFaqs] = useState<ChatbotFaqItem[]>([]);
  const [faqSearch, setFaqSearch] = useState("");
  const [editingFaq, setEditingFaq] = useState<ChatbotFaqItem | null>(null);
  const [isFaqDialogOpen, setIsFaqDialogOpen] = useState(false);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [faqCategory, setFaqCategory] = useState("general");
  const [faqKeywords, setFaqKeywords] = useState("");
  const [faqIsActive, setFaqIsActive] = useState(true);
  const [savingFaq, setSavingFaq] = useState(false);

  const openCreateFaq = () => {
    setEditingFaq(null);
    setFaqQuestion("");
    setFaqAnswer("");
    setFaqCategory("general");
    setFaqKeywords("");
    setFaqIsActive(true);
    setIsFaqDialogOpen(true);
  };

  const openEditFaq = (f: ChatbotFaqItem) => {
    setEditingFaq(f);
    setFaqQuestion(f.question);
    setFaqAnswer(f.answer);
    setFaqCategory(f.category || "general");
    setFaqKeywords((f.keywords || []).join(", "));
    setFaqIsActive(f.is_active);
    setIsFaqDialogOpen(true);
  };

  const handleSaveFaq = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      toast.error("Both Question and Answer are required.");
      return;
    }
    setSavingFaq(true);
    try {
      const keywordArr = faqKeywords
        .split(",")
        .map(k => k.trim().toLowerCase())
        .filter(Boolean);

      const payload = {
        question: faqQuestion.trim(),
        answer: faqAnswer.trim(),
        category: faqCategory,
        keywords: keywordArr,
        is_active: faqIsActive,
      };

      if (editingFaq) {
        const { error } = await supabase
          .from("chatbot_faqs")
          .update(payload)
          .eq("id", editingFaq.id);
        if (error) throw error;
        setFaqs(prev => prev.map(f => (f.id === editingFaq.id ? { ...f, ...payload } : f)));
        toast.success("Chatbot Q&A updated");
      } else {
        const { data, error } = await supabase
          .from("chatbot_faqs")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setFaqs(prev => [...prev, data as ChatbotFaqItem]);
        toast.success("New Chatbot Q&A added");
      }
      setIsFaqDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to save Q&A: " + msg);
    } finally {
      setSavingFaq(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Q&A? The chatbot will no longer use it.")) return;
    try {
      const { error } = await supabase.from("chatbot_faqs").delete().eq("id", id);
      if (error) throw error;
      setFaqs(prev => prev.filter(f => f.id !== id));
      toast.success("Chatbot Q&A deleted");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to delete Q&A: " + msg);
    }
  };

  const handleToggleFaqActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from("chatbot_faqs")
        .update({ is_active: !current })
        .eq("id", id);
      if (error) throw error;
      setFaqs(prev => prev.map(f => (f.id === id ? { ...f, is_active: !current } : f)));
      toast.success(!current ? "Q&A activated" : "Q&A paused");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Failed to update status: " + msg);
    }
  };

  // Fetch all administrative data
  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [
        { data: profData },
        { data: roleData },
        { data: kycData },
        { data: listingData },
        { data: faqData }
      ] = await Promise.all([
        supabase.from("profiles").select("id, custom_uid, full_name, phone, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("kyc").select("*").order("created_at", { ascending: false }),
        supabase.from("listings").select("id, landlord_id, title, rent_amount, division, district, available, created_at").order("created_at", { ascending: false }),
        supabase.from("chatbot_faqs").select("*").order("sort_order", { ascending: true })
      ]);

      const roles = roleData || [];
      const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));

      const mappedProfiles = (profData || []).map((p: any) => ({
        ...p,
        role: roleMap.get(p.id) || "tenant"
      }));

      setProfiles(mappedProfiles);
      setUserRoles(roles);
      setKycList(kycData || []);
      setListings(listingData || []);
      setFaqs(faqData || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Admin fetch error:", err);
      toast.error("Failed to load admin data: " + msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute joined KYC with profiles
  const enrichedKyc = useMemo(() => {
    const profMap = new Map(profiles.map(p => [p.id, p]));
    return kycList.map(k => ({
      ...k,
      profile: profMap.get(k.user_id)
    }));
  }, [kycList, profiles]);

  // Open KYC Inspection Modal
  const handleOpenKyc = async (item: KycItem) => {
    setSelectedKyc(item);
    setKycNotes(item.notes || "");
    setKycSignedUrls({});

    // Generate signed URLs for private images
    const getSigned = async (path: string | null) => {
      if (!path) return undefined;
      const { data } = await supabase.storage.from("kyc-docs").createSignedUrl(path, 3600);
      return data?.signedUrl;
    };

    const [front, back, selfie] = await Promise.all([
      getSigned(item.nid_front_url),
      getSigned(item.nid_back_url),
      getSigned(item.selfie_url)
    ]);

    setKycSignedUrls({ front, back, selfie });
  };

  // Update KYC status
  const handleUpdateKycStatus = async (status: "verified" | "rejected") => {
    if (!selectedKyc) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("kyc")
        .update({
          status,
          notes: kycNotes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedKyc.id);

      if (error) throw error;

      toast.success(`KYC marked as ${status}`);
      setSelectedKyc(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update KYC status");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle listing availability
  const handleToggleListing = async (listingId: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from("listings")
        .update({ available: !current })
        .eq("id", listingId);

      if (error) throw error;
      toast.success(`Listing marked as ${!current ? "Available" : "Unavailable"}`);
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, available: !current } : l));
    } catch (err: any) {
      toast.error("Failed to update listing: " + err.message);
    }
  };

  // Delete spam listing
  const handleDeleteListing = async (listingId: string) => {
    if (!confirm("Are you sure you want to remove this listing permanently?")) return;
    try {
      const { error } = await supabase.from("listings").delete().eq("id", listingId);
      if (error) throw error;
      toast.success("Listing deleted successfully");
      setListings(prev => prev.filter(l => l.id !== listingId));
    } catch (err: any) {
      toast.error("Failed to delete listing: " + err.message);
    }
  };

  // Change user role
  const handleChangeRole = async (userId: string, newRole: "tenant" | "landlord" | "admin") => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: newRole }, { onConflict: "user_id" });

      if (error) throw error;
      toast.success(`Role updated to ${newRole}`);
      if (userId === user?.id) {
        refreshProfile();
      }
      fetchData();
    } catch (err: any) {
      toast.error("Failed to change role: " + err.message);
    }
  };

  // Copy helper
  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Metrics
  const pendingKycCount = kycList.filter(k => k.status === "pending").length;
  const verifiedKycCount = kycList.filter(k => k.status === "verified").length;
  const activeListingsCount = listings.filter(l => l.available).length;

  return (
    <div className="container max-w-7xl py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <h1 className="font-display text-3xl font-bold">Platform Admin Console</h1>
            <Badge variant="outline" className="border-primary text-primary font-mono text-xs">
              ADMIN ACCESS
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized monitoring, user role management, KYC document review, and listing moderation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData} 
            disabled={refreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Admin Notice if user is exploring */}
      {role !== "admin" && (
        <Card className="border-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                You are currently logged in with role: <span className="uppercase font-mono">{role || "unassigned"}</span>
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                To grant your account permanent <strong>admin</strong> privileges, execute this SQL in your Supabase SQL editor:
              </p>
              <div className="mt-2 flex items-center gap-2 bg-background p-2 rounded border font-mono text-xs overflow-x-auto">
                <code className="flex-1">
                  INSERT INTO public.user_roles (user_id, role) VALUES ('{user?.id}', 'admin') ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
                </code>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => copyText(`INSERT INTO public.user_roles (user_id, role) VALUES ('${user?.id}', 'admin') ON CONFLICT (user_id) DO UPDATE SET role = 'admin';`, "SQL Command")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Registered Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {profiles.filter(p => p.role === "landlord").length} Landlords · {profiles.filter(p => p.role === "tenant").length} Tenants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending KYC Reviews</CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingKycCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {verifiedKycCount} Verified applicants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{listings.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeListingsCount} Active & available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Your Admin User ID</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold truncate">
              <span className="truncate">{user?.id}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => copyText(user?.id || "", "User ID")}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Session role: <span className="uppercase text-primary font-bold">{role}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="kyc" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-xl">
          <TabsTrigger value="kyc" className="flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" />
            KYC Approvals
            {pendingKycCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                {pendingKycCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="listings" className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            Listings
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Users & Roles
          </TabsTrigger>
          <TabsTrigger value="chatbot" className="flex items-center gap-1.5">
            <Bot className="h-4 w-4" />
            Chatbot Q&A
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB 1: KYC VERIFICATION ===================== */}
        <TabsContent value="kyc" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Identity Verification (KYC) Requests</CardTitle>
                <CardDescription>
                  Inspect submitted National IDs and applicant selfies to approve or reject verified badge status.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant={kycFilter === "all" ? "default" : "outline"} 
                  onClick={() => setKycFilter("all")}
                >
                  All ({kycList.length})
                </Button>
                <Button 
                  size="sm" 
                  variant={kycFilter === "pending" ? "default" : "outline"} 
                  onClick={() => setKycFilter("pending")}
                >
                  Pending ({pendingKycCount})
                </Button>
                <Button 
                  size="sm" 
                  variant={kycFilter === "verified" ? "default" : "outline"} 
                  onClick={() => setKycFilter("verified")}
                >
                  Verified ({verifiedKycCount})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {enrichedKyc.filter(k => kycFilter === "all" || k.status === kycFilter).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                  <p>No KYC records match the current filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="p-3">Applicant</th>
                        <th className="p-3">NID Number</th>
                        <th className="p-3">Documents</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Submitted</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {enrichedKyc
                        .filter(k => kycFilter === "all" || k.status === kycFilter)
                        .map(item => (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <div className="font-medium">{item.profile?.full_name || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground font-mono">{item.user_id.slice(0, 13)}...</div>
                            </td>
                            <td className="p-3 font-mono text-xs">
                              {item.nid_number || <span className="text-muted-foreground italic">Not provided</span>}
                            </td>
                            <td className="p-3 text-xs">
                              <span className="inline-flex items-center gap-1">
                                {item.nid_front_url && <Badge variant="outline" className="text-[10px]">Front</Badge>}
                                {item.nid_back_url && <Badge variant="outline" className="text-[10px]">Back</Badge>}
                                {item.selfie_url && <Badge variant="outline" className="text-[10px]">Selfie</Badge>}
                              </span>
                            </td>
                            <td className="p-3">
                              {item.status === "verified" && (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 w-fit">
                                  <ShieldCheck className="h-3 w-3" /> Verified
                                </Badge>
                              )}
                              {item.status === "pending" && (
                                <Badge variant="secondary" className="flex items-center gap-1 w-fit bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                  <ShieldAlert className="h-3 w-3" /> Pending Review
                                </Badge>
                              )}
                              {item.status === "rejected" && (
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                  <ShieldX className="h-3 w-3" /> Rejected
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-right">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 flex items-center gap-1"
                                onClick={() => handleOpenKyc(item)}
                              >
                                <Eye className="h-3.5 w-3.5" /> Review
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== TAB 2: LISTINGS MODERATION ===================== */}
        <TabsContent value="listings" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Listings Moderation</CardTitle>
                <CardDescription>
                  Manage property posts, deactivate fraudulent or expired ads, and monitor rental pricing.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search listings..." 
                  className="pl-8 h-9" 
                  value={listingSearch}
                  onChange={e => setListingSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="p-3">Property Title</th>
                      <th className="p-3">Location</th>
                      <th className="p-3">Monthly Rent</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {listings
                      .filter(l => 
                        !listingSearch || 
                        l.title.toLowerCase().includes(listingSearch.toLowerCase()) ||
                        (l.district && l.district.toLowerCase().includes(listingSearch.toLowerCase()))
                      )
                      .map(listing => (
                        <tr key={listing.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="font-medium line-clamp-1">{listing.title}</div>
                            <div className="text-xs text-muted-foreground font-mono">ID: {listing.id.slice(0, 8)}...</div>
                          </td>
                          <td className="p-3 text-xs">
                            {listing.district || listing.division || "Not specified"}
                          </td>
                          <td className="p-3 font-semibold text-primary">
                            ৳{listing.rent_amount?.toLocaleString()}
                          </td>
                          <td className="p-3">
                            <Badge variant={listing.available ? "default" : "secondary"}>
                              {listing.available ? "Available" : "Rented / Inactive"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-xs"
                              onClick={() => handleToggleListing(listing.id, listing.available)}
                            >
                              {listing.available ? "Deactivate" : "Activate"}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteListing(listing.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== TAB 3: USERS & ROLES ===================== */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>User & Role Management</CardTitle>
                <CardDescription>
                  Inspect registered tenants, landlords, and assign platform administrative privileges.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search user name or ID..." 
                  className="pl-8 h-9" 
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="p-3">User</th>
                      <th className="p-3">User IDs</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Current Role</th>
                      <th className="p-3 text-right">Assign Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {profiles
                      .filter(p => 
                        !userSearch || 
                        p.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
                        p.id.toLowerCase().includes(userSearch.toLowerCase()) ||
                        (p.custom_uid && p.custom_uid.toLowerCase().includes(userSearch.toLowerCase()))
                      )
                      .map(p => (
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">
                            {p.full_name || "Unnamed user"}
                            {p.id === user?.id && (
                              <Badge variant="outline" className="ml-2 text-[10px] text-primary border-primary">You</Badge>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {p.custom_uid ? (
                              <div className="flex items-center gap-1 font-bold text-foreground">
                                <span className="text-primary">{p.custom_uid}</span>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-5 w-5" 
                                  title="Copy Custom User ID"
                                  onClick={() => copyText(p.custom_uid!, "Custom User ID")}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-5 w-5 text-muted-foreground hover:text-foreground" 
                                  title="Edit Custom User ID"
                                  onClick={() => openEditUid(p)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="mb-1">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-6 text-[11px] px-2 py-0 border-dashed text-primary hover:bg-primary/5"
                                  onClick={() => openEditUid(p)}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Assign Custom UID
                                </Button>
                              </div>
                            )}
                            <div className="flex items-center text-[11px] text-muted-foreground">
                              <span title={p.id}>{p.id.slice(0, 14)}...</span>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-4 w-4 ml-1" 
                                onClick={() => copyText(p.id, "UUID")}
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {p.phone || "No phone"}
                          </td>
                          <td className="p-3">
                            <Badge 
                              variant={p.role === "admin" ? "default" : p.role === "landlord" ? "secondary" : "outline"}
                              className="capitalize"
                            >
                              {p.role}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex gap-1">
                              {p.role !== "tenant" && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-7 text-xs"
                                  onClick={() => handleChangeRole(p.id, "tenant")}
                                >
                                  Tenant
                                </Button>
                              )}
                              {p.role !== "landlord" && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-7 text-xs"
                                  onClick={() => handleChangeRole(p.id, "landlord")}
                                >
                                  Landlord
                                </Button>
                              )}
                              {p.role !== "admin" && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-xs border-primary text-primary hover:bg-primary/10"
                                  onClick={() => handleChangeRole(p.id, "admin")}
                                >
                                  Make Admin
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== TAB 4: CHATBOT Q&A ===================== */}
        <TabsContent value="chatbot" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Chatbot Auto-Reply & Knowledge Base
                </CardTitle>
                <CardDescription>
                  Configure automated questions, answers, and trigger keywords for the floating AI assistant. Users will see these suggestions and receive instant replies.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={openCreateFaq} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add Question & Answer
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Q&A or keywords..."
                    className="pl-8 text-xs"
                    value={faqSearch}
                    onChange={e => setFaqSearch(e.target.value)}
                  />
                </div>
                <Badge variant="outline" className="text-xs">
                  {faqs.length} Total Q&A Pairs
                </Badge>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="p-3">Question</th>
                      <th className="p-3">Auto-Reply Answer</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Keywords</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {faqs
                      .filter(f =>
                        !faqSearch ||
                        f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
                        f.answer.toLowerCase().includes(faqSearch.toLowerCase()) ||
                        (f.keywords || []).some(k => k.toLowerCase().includes(faqSearch.toLowerCase()))
                      )
                      .map(f => (
                        <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium max-w-[200px]">
                            {f.question}
                          </td>
                          <td className="p-3 text-muted-foreground max-w-[280px]">
                            <p className="line-clamp-2">{f.answer}</p>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="uppercase text-[10px]">
                              {f.category}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {(f.keywords || []).slice(0, 3).map((kw, i) => (
                                <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                                  {kw}
                                </span>
                              ))}
                              {(f.keywords || []).length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{f.keywords.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleToggleFaqActive(f.id, f.is_active)}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors cursor-pointer ${
                                f.is_active
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20"
                                  : "bg-muted text-muted-foreground border hover:bg-muted/80"
                              }`}
                            >
                              {f.is_active ? "Active" : "Paused"}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Edit Q&A"
                                onClick={() => openEditFaq(f)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                title="Delete Q&A"
                                onClick={() => handleDeleteFaq(f.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {faqs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No chatbot questions added yet. Click "Add Question & Answer" to create your first auto-reply.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* KYC Inspection Dialog */}
      <Dialog open={!!selectedKyc} onOpenChange={open => !open && setSelectedKyc(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Identity (KYC) Submission</DialogTitle>
            <DialogDescription>
              Verify the National ID information and photo evidence submitted by this user.
            </DialogDescription>
          </DialogHeader>

          {selectedKyc && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3 rounded-md">
                <div>
                  <span className="text-muted-foreground">Applicant:</span>{" "}
                  <strong>{selectedKyc.profile?.full_name || "Unknown"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">User ID:</span>{" "}
                  <code className="font-mono">{selectedKyc.user_id.slice(0, 18)}...</code>
                </div>
                <div>
                  <span className="text-muted-foreground">NID Number:</span>{" "}
                  <strong>{selectedKyc.nid_number || "None"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Status:</span>{" "}
                  <Badge variant="outline" className="capitalize text-[10px] ml-1">{selectedKyc.status}</Badge>
                </div>
              </div>

              {/* Document Images */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted Documents</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Front */}
                  <div className="border rounded-md p-2 space-y-1 text-center">
                    <p className="text-xs font-medium">NID Front</p>
                    {kycSignedUrls.front ? (
                      <a href={kycSignedUrls.front} target="_blank" rel="noreferrer" className="block relative group aspect-video bg-muted rounded overflow-hidden">
                        <img src={kycSignedUrls.front} alt="NID Front" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-black/40 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          View full <ExternalLink className="h-3 w-3 ml-1" />
                        </span>
                      </a>
                    ) : (
                      <div className="aspect-video bg-muted grid place-items-center text-xs text-muted-foreground">
                        Not uploaded
                      </div>
                    )}
                  </div>

                  {/* Back */}
                  <div className="border rounded-md p-2 space-y-1 text-center">
                    <p className="text-xs font-medium">NID Back</p>
                    {kycSignedUrls.back ? (
                      <a href={kycSignedUrls.back} target="_blank" rel="noreferrer" className="block relative group aspect-video bg-muted rounded overflow-hidden">
                        <img src={kycSignedUrls.back} alt="NID Back" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-black/40 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          View full <ExternalLink className="h-3 w-3 ml-1" />
                        </span>
                      </a>
                    ) : (
                      <div className="aspect-video bg-muted grid place-items-center text-xs text-muted-foreground">
                        Not uploaded
                      </div>
                    )}
                  </div>

                  {/* Selfie */}
                  <div className="border rounded-md p-2 space-y-1 text-center">
                    <p className="text-xs font-medium">Verification Selfie</p>
                    {kycSignedUrls.selfie ? (
                      <a href={kycSignedUrls.selfie} target="_blank" rel="noreferrer" className="block relative group aspect-video bg-muted rounded overflow-hidden">
                        <img src={kycSignedUrls.selfie} alt="Selfie" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 bg-black/40 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          View full <ExternalLink className="h-3 w-3 ml-1" />
                        </span>
                      </a>
                    ) : (
                      <div className="aspect-video bg-muted grid place-items-center text-xs text-muted-foreground">
                        Not uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="kycNotes" className="text-xs">Admin Notes / Rejection Reason</Label>
                <Textarea 
                  id="kycNotes" 
                  placeholder="Enter optional verification feedback or rejection reason..."
                  value={kycNotes}
                  onChange={e => setKycNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="destructive" 
              onClick={() => handleUpdateKycStatus("rejected")}
              disabled={actionLoading}
            >
              <ShieldX className="h-4 w-4 mr-1.5" /> Reject KYC
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white" 
              onClick={() => handleUpdateKycStatus("verified")}
              disabled={actionLoading}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve & Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Custom UID Assignment Dialog */}
      <Dialog open={!!editingUidUser} onOpenChange={open => !open && setEditingUidUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Custom User ID</DialogTitle>
            <DialogDescription>
              Assign a custom, memorable identifier to <strong>{editingUidUser?.full_name || "this user"}</strong>. Both this Custom UID and their Supabase UUID will work across the entire platform.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border bg-muted/40 p-3 space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">User Supabase UUID</span>
              <p className="text-xs font-mono break-all text-muted-foreground">{editingUidUser?.id}</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-uid-field">Custom UID</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-primary px-2 hover:bg-primary/5"
                  onClick={async () => {
                    try {
                      const { data } = await supabase.rpc("generate_custom_uid_from_name_email", {
                        p_name: editingUidUser?.full_name || "",
                        p_email: "",
                      });
                      if (data) {
                        setNewCustomUid(data);
                      } else {
                        const prefix = editingUidUser?.role === "landlord" ? "L" : "T";
                        const randNum = Math.floor(100000 + Math.random() * 900000);
                        setNewCustomUid(`${prefix}-${randNum}`);
                      }
                    } catch {
                      const prefix = editingUidUser?.role === "landlord" ? "L" : "T";
                      const randNum = Math.floor(100000 + Math.random() * 900000);
                      setNewCustomUid(`${prefix}-${randNum}`);
                    }
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Suggest ID
                </Button>
              </div>
              <Input
                id="custom-uid-field"
                value={newCustomUid}
                onChange={e => setNewCustomUid(e.target.value)}
                placeholder="e.g. rahim_rahim12, bkij1010, or TENANT-001"
                className="font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground">
                Must be unique. Both this Custom ID and the user's Supabase UUID work everywhere across the platform.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingUidUser(null)} disabled={savingUid}>
              Cancel
            </Button>
            <Button onClick={handleSaveCustomUid} disabled={savingUid}>
              {savingUid ? "Saving..." : "Save Custom UID"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chatbot Q&A Editor Dialog */}
      <Dialog open={isFaqDialogOpen} onOpenChange={setIsFaqDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFaq ? "Edit Chatbot Question & Answer" : "Add New Chatbot Question & Answer"}
            </DialogTitle>
            <DialogDescription>
              When a user asks this question or clicks the suggestion chip, the chatbot will automatically reply with this answer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="faq-q">Question (User prompt)</Label>
              <Input
                id="faq-q"
                value={faqQuestion}
                onChange={e => setFaqQuestion(e.target.value)}
                placeholder="e.g. How do I look up a tenant using their Custom ID?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="faq-a">Answer (Chatbot Auto-Reply)</Label>
              <Textarea
                id="faq-a"
                value={faqAnswer}
                onChange={e => setFaqAnswer(e.target.value)}
                placeholder="Write the clear, helpful answer the bot should provide..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="faq-cat">Category</Label>
                <select
                  id="faq-cat"
                  value={faqCategory}
                  onChange={e => setFaqCategory(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="general">General</option>
                  <option value="tenant">Tenant</option>
                  <option value="landlord">Landlord</option>
                  <option value="uid">Custom UID</option>
                  <option value="kyc">KYC Verification</option>
                  <option value="payment">Payments</option>
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer h-9 px-3 rounded-md border bg-muted/20">
                  <input
                    type="checkbox"
                    checked={faqIsActive}
                    onChange={e => setFaqIsActive(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-medium">Active (Visible in Chat)</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="faq-kw">Trigger Keywords (comma separated)</Label>
              <Input
                id="faq-kw"
                value={faqKeywords}
                onChange={e => setFaqKeywords(e.target.value)}
                placeholder="e.g. tenant, lookup, history, id, verification"
              />
              <p className="text-[11px] text-muted-foreground">
                If a user types any of these words in their question, the bot matches this answer.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsFaqDialogOpen(false)} disabled={savingFaq}>
              Cancel
            </Button>
            <Button onClick={handleSaveFaq} disabled={savingFaq}>
              {savingFaq ? "Saving..." : editingFaq ? "Update Q&A" : "Add Q&A"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
