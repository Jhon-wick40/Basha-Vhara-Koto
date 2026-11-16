//  Payment — simulated checkout for an accepted agreement.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CreditCard, Lock, Loader2, ArrowLeft, ShieldCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtBDT } from "@/lib/listings";
import { toast } from "sonner";

export default function Payment() {
  const { agreementId } = useParams<{ agreementId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [agreement, setAgreement] = useState<any>(null);
  const [card, setCard] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    (async () => {
      if (!agreementId) return;
      const { data, error } = await supabase
        .from("agreements")
        .select("*, listings(title, location)")
        .eq("id", agreementId)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching agreement:", error);
        return;
      }
      setAgreement(data);
    })();
  }, [agreementId]);

const pay = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Basic validation
  if (!user || !agreement) return;

  if (agreement.status !== "accepted") {
    toast.error("Agreement must be 'accepted' by the landlord before payment.");
    return;
  }

  if (!name || card.length < 16 || !exp || !cvv) {
    toast.error("Please fill in all payment details correctly.");
    return;
  }

  setPaying(true);

  try {
    // 1. CREATE PAYMENT RECORD
    const { data: payData, error: payError } = await supabase
      .from("payments")
      .insert({
        agreement_id: agreement.id,
        listing_id: agreement.listing_id,
        tenant_id: user.id,
        landlord_id: agreement.landlord_id,
        amount: agreement.agreed_price,
        status: "completed",
      })
      .select("id, receipt_number")
      .single();

    if (payError) throw new Error(`Payment Record Failed: ${payError.message}`);

    // 2. UPDATE LEASE STATUS
    const { error: agreementError } = await supabase
      .from("agreements")
      .update({ 
        status: "active", 
        updated_at: new Date().toISOString() 
      })
      .eq("id", agreement.id);

    if (agreementError) {
      console.warn("Could not update agreement status:", agreementError.message);
    }

    // 3. NOTIFY IN CONVERSATION
    await supabase.from("messages").insert({
      conversation_id: agreement.conversation_id,
      sender_id: user.id,
      content: `✅ Payment of ${fmtBDT(Number(agreement.agreed_price))} confirmed. Receipt: ${payData.receipt_number}`,
    });

    toast.success("Payment Successful!");
    navigate(`/receipt/${payData.id}`);

  } catch (error: any) {
    console.error("Critical Error:", error);
    toast.error(error.message || "An unexpected error occurred.");
  } finally {
    setPaying(false);
  }
};

  if (!agreement) {
    return (
      <div className="container py-20 grid place-items-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-12">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Messages
      </Button>

      <div className="grid md:grid-cols-[1fr_320px] gap-8">
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Secure Payment</h1>
            <ShieldCheck className="h-12 w-12 text-primary/20" />
          </div>

          <form onSubmit={pay} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Cardholder Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name on card" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card">Card Number</Label>
              <div className="relative">
                <Input id="card" value={card} maxLength={19} onChange={(e) => setCard(e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim())} placeholder="4242 4242 4242 4242" required />
                <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input id="expiry" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM/YY" maxLength={5} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input id="cvv" type="password" value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="123" maxLength={4} required />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={paying}>
              {paying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : `Confirm & Pay ${fmtBDT(Number(agreement.agreed_price))}`}
            </Button>
          </form>
        </Card>

        <Card className="p-6 h-fit bg-slate-50">
          <h3 className="font-semibold mb-4">Order Summary</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold">{agreement.listings?.title}</p>
              <p className="text-xs text-muted-foreground">{agreement.listings?.location}</p>
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="text-base font-bold">Total</span>
              <span className="text-xl font-black text-primary">{fmtBDT(Number(agreement.agreed_price))}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}