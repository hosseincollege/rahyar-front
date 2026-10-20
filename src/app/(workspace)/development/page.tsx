"use client";

import { Code2 } from "lucide-react";
import {
  getLocaleDirection,
  usePreferences,
} from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";

export default function DevelopmentPage() {
  const { locale } = usePreferences();
  return (
    <main
      dir={getLocaleDirection(locale)}
      className="mx-auto max-w-5xl space-y-5"
    >
      <header className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Code2 size={21} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {uiMessage(locale, "developmentTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {uiMessage(locale, "developmentDescription")}
          </p>
        </div>
      </header>
    </main>
  );
}
