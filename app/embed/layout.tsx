/**
 * Bare layout for all /embed/* routes.
 *
 * No dashboard chrome, no navigation — just the raw page content so it
 * renders cleanly inside an <iframe> on any gym's external website.
 * The root app/layout.tsx still provides <html>/<body>.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
