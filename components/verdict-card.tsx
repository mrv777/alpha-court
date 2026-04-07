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

function buildGaugeSvg(score: number): string {
  const radius = 80;
  const strokeWidth = 10;
  const center = 100;

  const scoreAngle = ((score + 100) / 200) * 180;
  const color = getScoreColor(score);

  function polarToCartesian(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center - radius * Math.sin(rad),
    };
  }

  const bgStart = polarToCartesian(180);
  const bgEnd = polarToCartesian(0);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;

  let fgPath = "";
  if (scoreAngle > 0) {
    const fgStart = polarToCartesian(180);
    const fgAngle = 180 - scoreAngle;
    const fgEnd = polarToCartesian(Math.max(fgAngle, 0));
    const largeArc = scoreAngle > 180 ? 1 : 0;
    fgPath = `<path d="M ${fgStart.x} ${fgStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${fgEnd.x} ${fgEnd.y}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
  }

  const scoreText = score > 0 ? `+${score}` : `${score}`;

  return `<svg viewBox="0 0 200 115" width="200" height="115">
    <path d="${bgPath}" fill="none" stroke="#1e1e2e" stroke-width="${strokeWidth}" stroke-linecap="round"/>
    ${fgPath}
    <text x="100" y="110" text-anchor="middle" fill="${color}" font-family="monospace" font-size="32" font-weight="bold">${scoreText}</text>
  </svg>`;
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
    <div style="height:8px;border-radius:4px;background:#1e1e2e;overflow:hidden">
      <div style="height:100%;width:${value}%;border-radius:4px;background:${color}"></div>
    </div>
  </div>`;
}

export function buildVerdictCardHtml(data: VerdictCardData): string {
  const scoreColor = getScoreColor(data.score);
  const safetyConfig = getSafetyConfig(data.safety);
  const displayName = data.tokenSymbol
    ? `$${data.tokenSymbol}`
    : data.tokenName;
  const summary = truncateSummary(data.summary);
  const gaugeSvg = buildGaugeSvg(data.score);

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
    <!-- Left: gauge + label -->
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;min-width:240px">
      ${gaugeSvg}
      <div style="font-size:36px;font-weight:800;color:${scoreColor};letter-spacing:-0.5px;text-align:center">${data.label}</div>
    </div>

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
