/**
 * Auth pages (login, register) use a clean layout without the sidebar.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
