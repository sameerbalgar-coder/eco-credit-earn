import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Globe, Bell, Moon, Smartphone, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const languages = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "kok", label: "कोंकणी (Konkani)" },
];

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [language, setLanguage] = useState("en");
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    const langName = languages.find((l) => l.value === value)?.label ?? value;
    toast({ title: "Language updated", description: `App language set to ${langName}.` });
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
      </div>

      {/* Language */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Language</h2>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground">Choose your preferred language for the app interface.</p>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue placeholder="Select a language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  <span className="flex items-center gap-2">
                    {language === lang.value && <Check className="h-3.5 w-3.5 text-primary" />}
                    {lang.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preferences */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Preferences</h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                <Bell className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Push Notifications</p>
                <p className="text-xs text-muted-foreground">Get alerts for pickup updates and credit rewards</p>
              </div>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                <Moon className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Reduce screen brightness in low light</p>
              </div>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </div>
      </div>

      {/* About */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">About</h2>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">App Version</span>
            <span className="font-medium text-foreground">1.0.0</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Region</span>
            <span className="font-medium text-foreground">Goa, India</span>
          </div>
          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5" />
            EcoCredit v1.0.0 — Built for a cleaner Goa
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
