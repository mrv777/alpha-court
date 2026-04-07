/**
 * Verdict Card — Standalone HTML for OG image generation.
 * Rendered by Puppeteer at 1200x630. Must be readable at Twitter preview size.
 * This exports a function that returns raw HTML string (no React rendering needed).
 */

export interface VerdictCardData {
  tokenName: string;
  tokenSymbol: string | null;
  chain: string;
  score: number;
  label: string;
  summary: string;
  bullConviction: number;
  bearConviction: number;
  safety: string;
  safetyReasons?: string[];
}

function getScoreColor(score: number): string {
  if (score >= 60) return "#22c55e";
  if (score >= 20) return "#4ade80";
  if (score > -20) return "#8888a0";
  if (score > -60) return "#f87171";
  return "#ef4444";
}

function getSafetyConfig(safety: string) {
  switch (safety) {
    case "dangerous":
      return { color: "#ef4444", icon: "💀", label: "Dangerous" };
    case "warnings":
      return { color: "#facc15", icon: "⚠️", label: "Warnings" };
    default:
      return { color: "#22c55e", icon: "🛡️", label: "Clean" };
  }
}

function truncateSummary(summary: string, maxLines: number = 3): string {
  // Rough truncation: ~80 chars per line at this font size
  const maxChars = maxLines * 85;
  if (summary.length <= maxChars) return summary;
  return summary.slice(0, maxChars - 3).trimEnd() + "...";
}

function buildScoreBarHtml(score: number, label: string): string {
  const color = getScoreColor(score);
  const scoreText = score > 0 ? `+${score}` : `${score}`;
  const position = ((score + 100) / 200) * 100;
  const fillFrom = score >= 0 ? 50 : position;
  const fillWidth = score >= 0 ? position - 50 : 50 - position;

  return `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;min-width:240px">
    <div style="font-size:56px;font-family:monospace;font-weight:bold;color:${color}">${scoreText}</div>
    <div style="font-size:28px;font-weight:800;color:${color};letter-spacing:2px;text-transform:uppercase">${label}</div>
    <div style="width:100%;position:relative">
      <div style="height:6px;width:100%;background:#1e1e2e;position:relative">
        <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:#555570"></div>
        <div style="position:absolute;left:${fillFrom}%;top:0;width:${fillWidth}%;height:100%;background:${color}"></div>
        <div style="position:absolute;left:${position}%;top:50%;transform:translate(-50%,-50%);width:2px;height:16px;background:${color}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span style="font-size:10px;font-family:monospace;color:#555570">-100</span>
        <span style="font-size:10px;font-family:monospace;color:#555570">0</span>
        <span style="font-size:10px;font-family:monospace;color:#555570">+100</span>
      </div>
    </div>
  </div>`;
}

function buildConvictionBar(
  label: string,
  value: number,
  color: string
): string {
  return `<div style="flex:1">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:13px;color:#8888a0">${label}</span>
      <span style="font-size:13px;font-family:monospace;font-weight:bold;color:${color}">${value}</span>
    </div>
    <div style="height:8px;background:#1e1e2e;overflow:hidden">
      <div style="height:100%;width:${value}%;background:${color}"></div>
    </div>
  </div>`;
}

export function buildVerdictCardHtml(data: VerdictCardData): string {
  const safetyConfig = getSafetyConfig(data.safety);
  const displayName = data.tokenSymbol
    ? `$${data.tokenSymbol}`
    : data.tokenName;
  const summary = truncateSummary(data.summary);
  const scoreBarHtml = buildScoreBarHtml(data.score, data.label);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px;
    height: 630px;
    background: linear-gradient(135deg, #0a0e1a 0%, #141824 50%, #0a0e1a 100%);
    color: #f0f0f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    display: flex;
    overflow: hidden;
  }
</style>
</head>
<body>
<div style="width:1200px;height:630px;padding:48px 56px;display:flex;flex-direction:column;position:relative">
  <!-- Top: branding + token -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:28px">⚖️</span>
      <span style="font-size:18px;font-weight:700;color:#f59e0b;letter-spacing:0.5px">ALPHA COURT</span>
    </div>
    <div style="text-align:right">
      <div style="font-size:14px;color:#555570;text-transform:uppercase;letter-spacing:1px">Verdict for</div>
      <div style="font-size:24px;font-weight:700;color:#f0f0f5">${displayName} <span style="font-size:14px;color:#555570;font-weight:400">on ${data.chain}</span></div>
    </div>
  </div>

  <!-- Divider -->
  <div style="height:1px;background:#1e1e2e;margin-bottom:32px"></div>

  <!-- Main content -->
  <div style="flex:1;display:flex;gap:48px;align-items:center">
    <!-- Left: score + label -->
    ${scoreBarHtml}

    <!-- Right: summary + meters + safety -->
    <div style="flex:1;display:flex;flex-direction:column;gap:24px">
      <!-- Summary -->
      <p style="font-size:18px;line-height:1.5;color:#c0c0d0;max-width:640px">${summary}</p>

      <!-- Conviction meters -->
      <div style="display:flex;gap:24px;max-width:500px">
        ${buildConvictionBar("Bull Conviction", data.bullConviction, "#22c55e")}
        ${buildConvictionBar("Bear Conviction", data.bearConviction, "#ef4444")}
      </div>

      <!-- Safety badge -->
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">${safetyConfig.icon}</span>
        <span style="font-size:14px;font-weight:600;color:${safetyConfig.color}">${safetyConfig.label}</span>
        ${data.safetyReasons && data.safetyReasons.length > 0 ? `<span style="font-size:12px;color:#555570;margin-left:4px">(${data.safetyReasons.length} finding${data.safetyReasons.length > 1 ? "s" : ""})</span>` : ""}
      </div>
    </div>
  </div>

  <!-- Bottom watermark -->
  <div style="position:absolute;bottom:24px;right:56px;font-size:12px;color:#555570">
    alphacourt.ai
  </div>
</div>
</body>
</html>`;
}
