"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      aria-label={!mounted ? "切换主题" : isDark ? "切换到浅色模式" : "切换到深色模式"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground transition-colors hover:bg-secondary"
    >
      {mounted ? (
        <>
          <Sun
            className={`size-4 transition-all duration-300 ${
              isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
            }`}
          />
          <Moon
            className={`absolute size-4 transition-all duration-300 ${
              isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0"
            }`}
          />
        </>
      ) : (
        <Sun className="size-4 opacity-0" />
      )}
    </button>
  )
}
