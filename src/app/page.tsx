import { redirect } from "next/navigation";

/**
 * Root route. Auth is already resolved by `proxy.ts`: unauthenticated visitors
 * are sent to `/login` before this renders, so reaching here means a signed-in
 * manager — hand them straight to the dashboard.
 */
export default function Home() {
  redirect("/dashboard");
}
