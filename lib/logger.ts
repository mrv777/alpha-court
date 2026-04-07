import fs from "fs";
import path from "path";

// ── Configuration ─────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 3; // keep current + 2 rotated

const LOG_DIR = process.env.LOG_PATH || path.join(process.cwd(), "data", "logs");
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

// ── Internals ─────────────────────────────────────────────────────────

let _initialized = false;
let _logPath = "";
let _currentSize = 0;

function ensureDir(): void {
  if (_initialized) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    _logPath = path.join(LOG_DIR, "app.log");
    _currentSize = fs.existsSync(_logPath) ? fs.statSync(_logPath).size : 0;
    _initialized = true;
  } catch {
    // If we can't create the log dir (e.g. read-only FS), fall back to console only
    _initialized = true;
  }
}

function rotate(): void {
  if (!_logPath) return;
  try {
    // Shift existing rotated files: app.2.log → deleted, app.1.log → app.2.log, etc.
    for (let i = MAX_FILES - 1; i >= 1; i--) {
      const older = path.join(LOG_DIR, `app.${i + 1}.log`);
      const current = path.join(LOG_DIR, `app.${i}.log`);
      if (i === MAX_FILES - 1 && fs.existsSync(older)) {
        fs.unlinkSync(older);
      }
      if (fs.existsSync(current)) {
        fs.renameSync(current, older);
      }
    }
    // Rotate current → app.1.log
    if (fs.existsSync(_logPath)) {
      fs.renameSync(_logPath, path.join(LOG_DIR, "app.1.log"));
    }
    _currentSize = 0;
  } catch {
    // Best-effort rotation — don't crash the app
  }
}

function formatEntry(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): string {
  const ts = new Date().toISOString();
  const metaStr = meta ? " " + JSON.stringify(meta) : "";
  return `${ts} [${level.toUpperCase()}] ${message}${metaStr}\n`;
}

function writeEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  ensureDir();
  const entry = formatEntry(level, message, meta);

  // Always write to file if available
  if (_logPath) {
    try {
      if (_currentSize >= MAX_FILE_SIZE) rotate();
      fs.appendFileSync(_logPath, entry);
      _currentSize += Buffer.byteLength(entry);
    } catch {
      // Fall back to console if file write fails
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => writeEntry("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => writeEntry("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => writeEntry("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => writeEntry("error", msg, meta),
};
