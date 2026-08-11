import { redirect } from "next/navigation";

export default function AppIndexPage() {
  redirect("/auth/resolve");
}
