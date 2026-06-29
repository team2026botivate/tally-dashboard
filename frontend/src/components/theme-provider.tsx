import * as React from "react"

type ThemeProviderProps = {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  React.useEffect(() => {
    document.documentElement.classList.remove("dark")
    document.documentElement.classList.add("light")
  }, [])

  return <>{children}</>
}
