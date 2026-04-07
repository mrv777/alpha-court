import { Scale } from "lucide-react";
import Link from "next/link";

export default async function TrialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <Scale className="size-12 text-judge mb-4" />
      <h1 className="text-2xl font-bold text-court-text mb-2">
        Trial {id}
      </h1>
      <p className="text-court-text-muted mb-6">
        The courtroom is being prepared...
      </p>
      <Link
        href="/"
        className="text-sm text-judge underline underline-offset-2 hover:text-judge/80 transition-colors"
      >
        Back to Alpha Court
      </Link>
    </main>
  );
}
