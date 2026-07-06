export function AuthFooter() {
  return (
    <footer className="flex items-center justify-center gap-7 py-8 text-sm text-muted-foreground">
      <a href="/privacy" className="hover:text-foreground">
        Privacy
      </a>
      <span>&bull;</span>
      <a href="/help" className="hover:text-foreground">
        Help
      </a>
    </footer>
  )
}
