import React, { useState } from "react";
import { Sparkles, Loader2, AlertCircle, Key, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGeminiApiKey, setGeminiApiKey, WasteAnalysisResult, HazardAnalysisResult } from "@/lib/gemini";

interface AiAnalysisBadgeProps {
  isAnalyzing: boolean;
  result?: WasteAnalysisResult | HazardAnalysisResult | null;
  onApplyCategory?: (category: string) => void;
  className?: string;
}

export const AiAnalysisBadge: React.FC<AiAnalysisBadgeProps> = ({
  isAnalyzing,
  result,
  onApplyCategory,
  className = "",
}) => {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState(getGeminiApiKey() || "");
  const [savedKey, setSavedKey] = useState(Boolean(getGeminiApiKey()));

  const handleSaveKey = () => {
    setGeminiApiKey(keyInput);
    setSavedKey(Boolean(getGeminiApiKey()));
    setShowKeyModal(false);
  };

  if (!isAnalyzing && !result && savedKey && !showKeyModal) {
    return null;
  }

  return (
    <div className={`transition-all ${className}`}>
      {/* 1. Loading State */}
      {isAnalyzing && (
        <div className="flex items-center gap-3 bg-primary/5 border-primary/20 p-3 rounded-xl">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Gemini AI analyzing photo...
            </p>
            <p className="text-[11px] text-muted-foreground">
              Optimized for Free Tier: compressing image & auto-detecting waste
            </p>
          </div>
        </div>
      )}

      {/* 2. Success State with Suggestion */}
      {!isAnalyzing && result && result.isAiGenerated && (
        <div className="bg-primary/5 border-primary/30 p-3 rounded-xl space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground capitalize">
                AI Detected: {"category" in result ? result.category : result.hazardType}
              </span>
              {"confidence" in result && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {Math.round(result.confidence * 100)}% match
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              title="Manage Gemini Free Key"
            >
              <Key className="h-3 w-3" />
              AI Key
            </button>
          </div>

          <p className="text-xs text-muted-foreground">{result.description}</p>

          {"ecoTip" in result && result.ecoTip && (
            <p className="text-[11px] text-primary/90 bg-primary/10 px-2 py-1 rounded-md">
              ≡ƒÆí <strong>Tip:</strong> {result.ecoTip}
            </p>
          )}

          {"safetyPrecaution" in result && result.safetyPrecaution && (
            <p className="text-[11px] text-destructive bg-destructive/10 px-2 py-1 rounded-md">
              ΓÜá∩╕Å <strong>Precaution:</strong> {result.safetyPrecaution}
            </p>
          )}

          {"category" in result && onApplyCategory && (
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Category auto-selected</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2"
                onClick={() => onApplyCategory(result.category)}
              >
                <Check className="h-3 w-3 mr-1" /> Re-apply
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 3. Handled Error or Rate Limit Notice */}
      {!isAnalyzing && result && !result.isAiGenerated && result.error && (
        <div className="bg-amber-500/10 border-amber-500/30 p-3 rounded-xl space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold">AI notice</span>
            </div>
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className="text-[10px] text-primary underline flex items-center gap-1"
            >
              <Key className="h-3 w-3" />
              {savedKey ? "Change Key" : "Set Gemini Key"}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">{result.error}</p>
          <p className="text-[10px] text-muted-foreground/80">
            You can continue submitting by selecting categories manually.
          </p>
        </div>
      )}

      {/* 4. Missing Key Prompt when no result yet */}
      {!isAnalyzing && !result && !savedKey && (
        <div className="p-2.5 bg-muted/40 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Enable free Gemini AI auto-detection</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] text-primary px-2"
            onClick={() => setShowKeyModal(true)}
          >
            Add Key
          </Button>
        </div>
      )}

      {/* Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl border border-border space-y-4 animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                Gemini API Key (Free Trial)
              </h3>
              <p className="text-xs text-muted-foreground">
                Get a free key from Google AI Studio (ai.google.dev). Stored securely in your browser session.
              </p>
            </div>

            <Input
              type="password"
              placeholder="AIzaSy..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="font-mono text-xs rounded-xl"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => setShowKeyModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={handleSaveKey}
              >
                Save Key
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

