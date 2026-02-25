import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  ChevronRight,
} from "lucide-react";

const transactions = [
  { id: 1, type: "credit", label: "Plastic Collection", amount: 15, date: "Today, 2:30 PM" },
  { id: 2, type: "credit", label: "Streak Bonus", amount: 10, date: "Today, 2:30 PM" },
  { id: 3, type: "debit", label: "Coupon Redemption", amount: -50, date: "Yesterday" },
  { id: 4, type: "credit", label: "E-Waste Pickup", amount: 25, date: "Jan 20" },
  { id: 5, type: "credit", label: "Organic Waste", amount: 8, date: "Jan 19" },
  { id: 6, type: "credit", label: "Weekly Challenge", amount: 50, date: "Jan 18" },
];

const coupons = [
  { id: 1, brand: "Amazon", value: "₹50 Off", cost: 500, emoji: "🛒" },
  { id: 2, brand: "Swiggy", value: "₹30 Off", cost: 300, emoji: "🍔" },
  { id: 3, brand: "Flipkart", value: "₹100 Off", cost: 1000, emoji: "📦" },
];

const WalletPage = () => {
  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-lg font-bold text-foreground">Wallet</h1>

      {/* Balance Card */}
      <div className="eco-gradient rounded-2xl p-5 eco-shadow-lg">
        <p className="text-xs font-medium text-primary-foreground/70">Total Credits</p>
        <p className="text-4xl font-bold text-primary-foreground">1,250</p>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-primary-foreground/60">= ₹125.00 equivalent</p>
          <div className="rounded-lg bg-primary-foreground/15 px-3 py-1.5">
            <span className="text-xs font-semibold text-primary-foreground">
              100 credits = ₹10
            </span>
          </div>
        </div>
      </div>

      {/* Redeem */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Redeem Credits</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {coupons.map((c) => (
            <div
              key={c.id}
              className="flex min-w-[140px] flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center"
            >
              <span className="text-3xl">{c.emoji}</span>
              <p className="text-sm font-semibold text-foreground">{c.brand}</p>
              <p className="text-xs text-primary font-medium">{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.cost} credits</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Transaction History</h2>
        <div className="space-y-2">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    t.amount > 0 ? "bg-eco-success/10" : "bg-destructive/10"
                  }`}
                >
                  {t.amount > 0 ? (
                    <ArrowDownLeft className="h-4 w-4 text-eco-success" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
              </div>
              <span
                className={`text-sm font-semibold ${
                  t.amount > 0 ? "text-eco-success" : "text-destructive"
                }`}
              >
                {t.amount > 0 ? "+" : ""}
                {t.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
