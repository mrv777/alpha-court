import { redirect } from "next/navigation";
import { DebugClient } from "./debug-client";

export default function DebugPage() {
  if (process.env.DEBUG_ENABLED !== "true") {
    redirect("/");
  }

  return <DebugClient />;
}
