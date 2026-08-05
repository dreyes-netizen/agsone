import { redirect } from "next/navigation";
import { cookies } from "next/headers";

// A signed-in user landing on the bare root URL was always bounced to /login
// (the auth check only ever ran in proxy.ts on other routes) — this mirrors
// that same cookie-presence check so returning users land in the app instead
// of seeing the sign-in screen again.
export default async function Home() {
  const cookieStore = await cookies();
  const isAuthed = Boolean(cookieStore.get("firebase-token")?.value);
  redirect(isAuthed ? "/dashboard" : "/login");
}
