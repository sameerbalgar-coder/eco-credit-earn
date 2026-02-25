import { NavLink, useLocation } from "react-router-dom";
import { Home, MapPin, Camera, Wallet, User } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/map", icon: MapPin, label: "Map" },
  { to: "/report", icon: Camera, label: "Report" },
  { to: "/wallet", icon: Wallet, label: "Wallet" },
  { to: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around pb-[env(safe-area-inset-bottom,0px)]">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-2.5 text-xs transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                  active ? "eco-gradient-soft" : ""
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              </div>
              <span className={active ? "font-semibold" : "font-medium"}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
