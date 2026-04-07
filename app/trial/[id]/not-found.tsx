import Link from "next/link";
import { Scale } from "lucide-react";

export default function TrialNotFound() {
  return (
    <div className="min-h-screen bg-court-bg flex flex-col items-center justify-center px-4">
      <Scale className="size-12 text-court-text-dim mb-4" />
      <h1 className="text-2xl font-bold text-court-text mb-2">
        Trial Not Found
      </h1>
      <p className="text-sm text-court-text-muted mb-6 text-center max-w-sm">
        This trial doesn&apos;t exist or has been removed from the docket.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-judge/10 border border-judge/20 px-4 py-2 text-sm font-medium text-judge hover:bg-judge/20 transition-colors"
      >
        Back to Alpha Court
      </Link>
    </div>
  );
}
