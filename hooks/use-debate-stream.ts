"use client";

import { useEffect, useRef, useCallback, useReducer } from "react";
import type { DebatePhase, AgentRole } from "@/lib/agents/types";

// ── Types ─────────────────────────────────────────────────────────────

export interface DebateMessage {
  agent: AgentRole;
  phase: DebatePhase;
  content: string;
  evidence: Array<{ endpoint: string; displayValue: string }>;
  isStreaming: boolean;
}

export interface DataProgress {
  endpoint: string;
  agent: AgentRole;
  status: "pending" | "complete" | "error";
}

export interface Verdict {
  score: number;
  label: string;
  summary: string;
  bull_conviction: number;
  bear_conviction: number;
  safety: string;
}

export interface DebateStreamState {
  messages: DebateMessage[];
  phase: DebatePhase | null;
  verdict: Verdict | null;
  isStreaming: boolean;
  error: string | null;
  dataProgress: DataProgress[];
}

// ── Reducer ───────────────────────────────────────────────────────────

type Action =
  | { type: "PHASE"; phase: DebatePhase; status: "start" | "complete" }
  | { type: "DATA_PROGRESS"; endpoint: string; agent: AgentRole; status: "pending" | "complete" | "error" }
  | { type: "CHUNK"; agent: AgentRole; phase: DebatePhase; text: string }
  | { type: "MESSAGE_COMPLETE"; agent: AgentRole; phase: DebatePhase; content: string; evidence: Array<{ endpoint: string; displayValue: string }> }
  | { type: "VERDICT"; verdict: Verdict }
  | { type: "ERROR"; message: string }
  | { type: "DONE" }
  | { type: "RESET" };

function findStreamingMessage(
  messages: DebateMessage[],
  agent: AgentRole,
  phase: DebatePhase
): number {
  return messages.findIndex(
    (m) => m.agent === agent && m.phase === phase && m.isStreaming
  );
}

function reducer(state: DebateStreamState, action: Action): DebateStreamState {
  switch (action.type) {
    case "PHASE":
      return {
        ...state,
        phase: action.phase,
      };

    case "DATA_PROGRESS": {
      const existing = state.dataProgress.findIndex(
        (dp) => dp.endpoint === action.endpoint && dp.agent === action.agent
      );
      const updated = [...state.dataProgress];
      const entry: DataProgress = {
        endpoint: action.endpoint,
        agent: action.agent,
        status: action.status,
      };
      if (existing >= 0) {
        updated[existing] = entry;
      } else {
        updated.push(entry);
      }
      return { ...state, dataProgress: updated };
    }

    case "CHUNK": {
      const idx = findStreamingMessage(state.messages, action.agent, action.phase);
      const messages = [...state.messages];

      if (idx >= 0) {
        messages[idx] = {
          ...messages[idx],
          content: messages[idx].content + action.text,
        };
      } else {
        messages.push({
          agent: action.agent,
          phase: action.phase,
          content: action.text,
          evidence: [],
          isStreaming: true,
        });
      }

      return { ...state, messages };
    }

    case "MESSAGE_COMPLETE": {
      const idx = findStreamingMessage(state.messages, action.agent, action.phase);
      const messages = [...state.messages];

      if (idx >= 0) {
        messages[idx] = {
          agent: action.agent,
          phase: action.phase,
          content: action.content,
          evidence: action.evidence,
          isStreaming: false,
        };
      } else {
        messages.push({
          agent: action.agent,
          phase: action.phase,
          content: action.content,
          evidence: action.evidence,
          isStreaming: false,
        });
      }

      return { ...state, messages };
    }

    case "VERDICT":
      return { ...state, verdict: action.verdict };

    case "ERROR":
      return { ...state, error: action.message };

    case "DONE":
      return { ...state, isStreaming: false };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

const initialState: DebateStreamState = {
  messages: [],
  phase: null,
  verdict: null,
  isStreaming: true,
  error: null,
  dataProgress: [],
};

// ── Hook ──────────────────────────────────────────────────────────────

export function useDebateStream(trialId: string | null): DebateStreamState {
  const [state, dispatch] = useReducer(reducer, initialState);
  const retryCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!trialId || !mountedRef.current) return;

    const es = new EventSource(`/api/debate/${trialId}`);
    eventSourceRef.current = es;

    es.addEventListener("phase", (e) => {
      const data = JSON.parse(e.data);
      dispatch({ type: "PHASE", phase: data.phase, status: data.status });
    });

    es.addEventListener("data_progress", (e) => {
      const data = JSON.parse(e.data);
      dispatch({
        type: "DATA_PROGRESS",
        endpoint: data.endpoint,
        agent: data.agent,
        status: data.status,
      });
    });

    es.addEventListener("chunk", (e) => {
      const data = JSON.parse(e.data);
      dispatch({
        type: "CHUNK",
        agent: data.agent,
        phase: data.phase,
        text: data.text,
      });
    });

    es.addEventListener("message_complete", (e) => {
      const data = JSON.parse(e.data);
      dispatch({
        type: "MESSAGE_COMPLETE",
        agent: data.agent,
        phase: data.phase,
        content: data.content,
        evidence: data.evidence || [],
      });
    });

    es.addEventListener("verdict", (e) => {
      const data = JSON.parse(e.data);
      dispatch({ type: "VERDICT", verdict: data });
    });

    es.addEventListener("error", (e) => {
      // SSE "error" event from our server
      if (e instanceof MessageEvent && e.data) {
        const data = JSON.parse(e.data);
        dispatch({ type: "ERROR", message: data.message });
      }
    });

    es.addEventListener("done", () => {
      dispatch({ type: "DONE" });
      es.close();
      retryCountRef.current = 0;
    });

    // EventSource built-in error (connection lost)
    es.onerror = () => {
      es.close();

      // Don't retry if component unmounted
      if (!mountedRef.current) return;

      // Reconnect with exponential backoff (max 5 retries)
      if (retryCountRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 16000);
        retryCountRef.current++;
        setTimeout(() => {
          if (!mountedRef.current) return;
          dispatch({ type: "RESET" });
          connect();
        }, delay);
      } else {
        dispatch({ type: "ERROR", message: "Connection lost. Please refresh." });
        dispatch({ type: "DONE" });
      }
    };
  }, [trialId]);

  useEffect(() => {
    mountedRef.current = true;
    dispatch({ type: "RESET" });
    retryCountRef.current = 0;
    connect();

    return () => {
      mountedRef.current = false;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [connect]);

  return state;
}
