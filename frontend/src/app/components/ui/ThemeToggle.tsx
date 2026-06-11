"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./button";

const modes = ["light", "dark", "system"] as const;

const icons = { light: Sun, dark: Moon, system: Monitor } as const;

const labels: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function nextMode(current: string): string {
  const idx = modes.indexOf(current as typeof modes[number]);
  return modes[(idx + 1) % modes.length];
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const Icon = icons[theme as keyof typeof icons] ?? Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-full"
      onClick={() => setTheme(nextMode(theme))}
      title={`Theme: ${labels[theme] ?? "Light"}`}
    >
      <Icon className="size-[1.1rem]" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
