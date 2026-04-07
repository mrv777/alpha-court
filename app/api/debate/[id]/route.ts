import { getDb } from "@/lib/db";
import { runDebate, activeDebates, type DebateEvent, type ActiveDebate } from "@/lib/debate-engine";

export const dynamic = "force-dynamic";

function formatSSE(event: DebateEvent): string {
  const { type, ...data } = event;
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

interface TrialRow {
  id: string;
  token_address: string;
  chain: string;
  token_name: string | null;
  token_symbol: string | null;
  token_icon_url: string | null;
  price_usd: number | null;
  mcap_usd: number | null;
  liquidity_usd: number | null;
  status: string;
  verdict_score: number | null;
  verdict_label: string | null;
  verdict_summary: string | null;
  bull_conviction: number | null;
  bear_conviction: number | null;
  safety_score: string | null;
  error_message: string | null;
}

interface MessageRow {
  agent: string;
  phase: string;
  content: string;
  evidence_json: string | null;
  sequence: number;
}

function getStoredMessages(trialId: string): MessageRow[] {
  return getDb()
    .prepare(
      "SELECT agent, phase, content, evidence_json, sequence FROM debate_messages WHERE trial_id = ? ORDER BY sequence"
    )
    .all(trialId) as MessageRow[];
}

function replayMessages(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  messages: MessageRow[]
): void {
  // Determine completed phases from stored messages
  const phases = new Set(messages.map((m) => m.phase));

  for (const phase of phases) {
    controller.enqueue(
      encoder.encode(formatSSE({ type: "phase", phase: phase as DebateEvent["type"] extends string ? string : never, status: "complete" } as DebateEvent))
    );
  }

  for (const msg of messages) {
    const evidence = msg.evidence_json ? JSON.parse(msg.evidence_json) : [];
    controller.enqueue(
      encoder.encode(
        formatSSE({
          type: "message_complete",
          agent: msg.agent,
          phase: msg.phase,
          content: msg.content,
          evidence,
        } as DebateEvent)
      )
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trialId } = await params;

  const db = getDb();
  const trial = db
    .prepare("SELECT * FROM trials WHERE id = ?")
    .get(trialId) as TrialRow | undefined;

  if (!trial) {
    return Response.json({ error: "Trial not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (event: DebateEvent) => {
        try {
          controller.enqueue(encoder.encode(formatSSE(event)));
        } catch {
          // Controller closed, client disconnected — ignore
        }
      };

      // Helper: emit token stats if available
      const emitTokenStats = () => {
        if (trial.price_usd != null || trial.token_icon_url != null) {
          enqueue({
            type: "token_stats",
            tokenIconUrl: trial.token_icon_url,
            priceUsd: trial.price_usd,
            mcapUsd: trial.mcap_usd,
            liquidityUsd: trial.liquidity_usd,
          } as DebateEvent);
        }
      };

      // ── Completed trial → replay all messages ───────────────────
      if (trial.status === "completed") {
        const messages = getStoredMessages(trialId);
        replayMessages(controller, encoder, messages);
        emitTokenStats();

        // Emit verdict
        if (trial.verdict_score !== null) {
          enqueue({
            type: "verdict",
            score: trial.verdict_score,
            label: trial.verdict_label ?? "",
            summary: trial.verdict_summary ?? "",
            bull_conviction: trial.bull_conviction ?? 0,
            bear_conviction: trial.bear_conviction ?? 0,
            safety: trial.safety_score ?? "clean",
          });
        }

        enqueue({ type: "done" });
        controller.close();
        return;
      }

      // ── Error trial → replay messages + error ───────────────────
      if (trial.status === "error") {
        const messages = getStoredMessages(trialId);
        replayMessages(controller, encoder, messages);
        emitTokenStats();
        enqueue({
          type: "error",
          message: trial.error_message ?? "Unknown error",
          recoverable: false,
        });
        enqueue({ type: "done" });
        controller.close();
        return;
      }

      // ── In-progress trial → replay completed + join live ────────
      const existingDebate = activeDebates.get(trialId);
      if (existingDebate) {
        // Replay already-completed messages from DB
        const messages = getStoredMessages(trialId);
        replayMessages(controller, encoder, messages);
        emitTokenStats();

        // Join the live stream
        const listener = (event: DebateEvent) => {
          enqueue(event);
          if (event.type === "done") {
            existingDebate.listeners.delete(listener);
            try {
              controller.close();
            } catch {
              // Already closed
            }
          }
        };
        existingDebate.listeners.add(listener);

        // Handle client disconnect
        request.signal.addEventListener("abort", () => {
          existingDebate.listeners.delete(listener);
        });
        return;
      }

      // ── Pending trial → start the debate engine ─────────────────
      const listeners = new Set<(event: DebateEvent) => void>();
      const primaryListener = (event: DebateEvent) => {
        enqueue(event);
        if (event.type === "done") {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      };

      const debatePromise = runDebate(
        trialId,
        trial.token_address,
        trial.chain,
        trial.token_name ?? trial.token_symbol ?? trial.token_address,
        primaryListener
      );

      const activeDebate: ActiveDebate = { promise: debatePromise, listeners };
      activeDebates.set(trialId, activeDebate);

      // Handle client disconnect — debate continues server-side
      request.signal.addEventListener("abort", () => {
        // Don't stop the debate, just stop writing to this controller
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
