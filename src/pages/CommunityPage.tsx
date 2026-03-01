import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, Calendar, MapPin, Users, Plus, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const CommunityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("events").select("*").gte("event_date", new Date().toISOString()).order("event_date", { ascending: true }),
      supabase.from("event_volunteers").select("event_id").eq("user_id", user.id),
    ]).then(([evRes, volRes]) => {
      if (evRes.data) setEvents(evRes.data);
      if (volRes.data) setJoined(new Set(volRes.data.map((v: any) => v.event_id)));
      setLoading(false);
    });
  }, [user]);

  const handleJoin = async (eventId: string) => {
    if (!user) return;
    const { error } = await supabase.from("event_volunteers").insert({ event_id: eventId, user_id: user.id } as any);
    if (!error) {
      setJoined(prev => new Set(prev).add(eventId));
      toast({ title: "Joined! 🎉", description: "You're signed up as a volunteer." });
    }
  };

  const handleLeave = async (eventId: string) => {
    if (!user) return;
    await supabase.from("event_volunteers").delete().eq("event_id", eventId).eq("user_id", user.id);
    setJoined(prev => { const s = new Set(prev); s.delete(eventId); return s; });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Community & Events</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No upcoming events</p>
          <p className="text-xs text-muted-foreground mt-1">Check back soon for cleanliness drives!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(ev => (
            <div key={ev.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {ev.image_url && (
                <img src={ev.image_url} alt={ev.title} className="h-36 w-full object-cover" />
              )}
              <div className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{ev.title}</h3>
                {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDate(ev.event_date)} at {formatTime(ev.event_date)}</span>
                  {ev.location_name && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {ev.location_name}</span>}
                  {ev.max_volunteers && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Max {ev.max_volunteers}</span>}
                </div>

                {joined.has(ev.id) ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-medium text-eco-success"><CheckCircle className="h-3.5 w-3.5" /> Joined</span>
                    <Button size="sm" variant="outline" className="ml-auto rounded-lg text-xs h-7" onClick={() => handleLeave(ev.id)}>Leave</Button>
                  </div>
                ) : (
                  <Button size="sm" className="w-full rounded-lg" onClick={() => handleJoin(ev.id)}>
                    <Users className="mr-1.5 h-4 w-4" /> Join as Volunteer
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityPage;
