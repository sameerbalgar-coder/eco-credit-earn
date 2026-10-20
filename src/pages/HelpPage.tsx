import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, LifeBuoy, Mail, User, MessageSquare, Send } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const faqs = [
  {
    q: "How do I earn carbon credits?",
    a: "You earn credits by reporting waste through the app. Once a supervisor verifies your report and a worker completes the cleanup, credits are automatically added to your wallet.",
  },
  {
    q: "What can I do with my credits?",
    a: "Credits can be redeemed for discounts and offers from participating local businesses. Check the Wallet page to see your balance and available offers.",
  },
  {
    q: "How do I request a pickup?",
    a: "Go to the On-Demand Pickup page, select your waste type, choose a date and time slot, and submit. A recycling partner will confirm your request.",
  },
  {
    q: "Why was my report rejected?",
    a: "Reports may be rejected if the photo is unclear, the waste type doesn't match the image, or the location is incorrect. You can always submit a new report with better photos.",
  },
  {
    q: "What should I do about hazardous waste?",
    a: "Use the Hazard Report option from the home screen. Hazardous waste is prioritized and handled by specially trained workers.",
  },
  {
    q: "How does the AI photo verification work?",
    a: "When you upload a photo, our AI checks if it's genuine and not AI-generated or manipulated. This ensures fair credit distribution and prevents fraud.",
  },
];

const HelpPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issue, setIssue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !issue.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSubmitting(false);
    setName("");
    setEmail("");
    setIssue("");
    toast({
      title: "Support request sent!",
      description: "We'll get back to you within 24 hours.",
    });
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Help & Support</h1>
      </div>

      {/* FAQ */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Frequently Asked Questions</h2>
        </div>
        <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-4">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-sm font-medium text-foreground text-left">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Contact Support */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Contact Support</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Name
            </label>
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Issue
            </label>
            <Textarea
              placeholder="Describe your problem..."
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="rounded-xl min-h-[100px] resize-none"
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full rounded-xl py-5 text-sm font-semibold">
            <Send className="mr-2 h-4 w-4" />
            {submitting ? "Sending..." : "Send Message"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default HelpPage;
