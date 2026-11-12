import { createHash } from "node:crypto";
import {
  analyseCsv,
  indexSource,
  validateEvidence,
} from "../agent-sdk/service-tools.mjs";
import { SERVICES } from "./genesis.mjs";
const str = { type: "string", maxLength: 500 },
  strings = { type: "array", items: str };
const object = (properties) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const section = object({
  heading: { type: "string", minLength: 1, maxLength: 150 },
  body: { type: "string", minLength: 1, maxLength: 2500 },
});
export const TOOL_SCHEMAS = {
  plan: object({
    title: { type: "string", minLength: 1, maxLength: 150 },
    sections: { type: "array", items: section, minItems: 3, maxItems: 8 },
    evidence: {
      type: "array",
      items: object({ quote: str }),
      minItems: 1,
      maxItems: 5,
    },
    assumptions: strings,
  }),
  website: object({
    title: { type: "string", minLength: 1, maxLength: 150 },
    subtitle: { type: "string", minLength: 1, maxLength: 150 },
    color: {
      type: "string",
      pattern: "^#[a-fA-F0-9]{6}$",
      description:
        "Actual six-digit hex accent color with text contrast at least 4.5:1 against #faf7ef.",
    },
    sections: { type: "array", items: section, minItems: 3, maxItems: 8 },
    callToAction: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      description:
        "Visitor-facing next step, e.g. Plan your gathering. No fabricated contact information.",
    },
  }),
  design: object({
    title: { type: "string", minLength: 1, maxLength: 150 },
    palette: {
      type: "array",
      items: { type: "string", pattern: "^#[a-fA-F0-9]{6}$" },
      minItems: 3,
      maxItems: 5,
      description: "Three to five actual hex color values, never color names.",
    },
    principles: { type: "array", items: str, minItems: 2, maxItems: 8 },
    typography: {
      type: "string",
      minLength: 20,
      maxLength: 500,
      description:
        "Concise font family, hierarchy and readability guidance; do not repeat text.",
    },
  }),
  evidence: object({
    findings: {
      type: "array",
      items: object({
        heading: { type: "string", minLength: 1, maxLength: 100 },
        sourceId: { type: "string", pattern: "^S[1-9][0-9]*$" },
        quote: {
          type: "string",
          minLength: 20,
          maxLength: 600,
          description:
            "An exact continuous substring copied from the identified source text. No paraphrase, unescaping, omitted words or ellipsis.",
        },
      }),
      minItems: 1,
      maxItems: 6,
    },
  }),
};
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const bounded = (s, max = 5000) => {
  if (typeof s !== "string" || !s.trim() || s.length > max)
    throw Error("Invalid bounded tool output");
  return s;
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
export function contrastRatio(a, b) {
  const luminance = (hex) => {
    if (!/^#[a-f0-9]{6}$/i.test(hex)) throw Error("Hex colors required");
    const v = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function prepareTool(serviceId, input) {
  const service = SERVICES[serviceId];
  if (
    !service ||
    typeof input !== "string" ||
    input.length < 40 ||
    input.length > 16000
  )
    throw Error("Supported service and 40–16000 input characters required");
  if (service.type === "csv")
    return { service, context: { input }, requiresInference: false };
  return {
    service,
    schema: TOOL_SCHEMAS[service.type],
    context: {
      input,
      ...(service.type === "evidence" ? { sources: indexSource(input) } : {}),
    },
    requiresInference: true,
  };
}
export function verifyAndRender(serviceId, input, value) {
  const { service } = prepareTool(serviceId, input);
  let files = [],
    checks = [];
  if (service.type === "csv") {
    const result = analyseCsv(input);
    files = [
      {
        filename: "analysis.json",
        contentType: "application/json",
        content: JSON.stringify(result, null, 2),
      },
      {
        filename: "analysis.md",
        contentType: "text/markdown",
        content:
          "# Exact CSV analysis\n\n" +
          JSON.stringify(result, null, 2) +
          "\n\nStatistics describe supplied data, not proof of its accuracy.",
      },
    ];
    checks = [
      "CSV syntax and row widths validated",
      "Statistics use exact decimal arithmetic",
    ];
  } else if (service.type === "evidence") {
    validateEvidence(value, indexSource(input));
    files = [
      {
        filename: "evidence.md",
        contentType: "text/markdown",
        content:
          "# Evidence brief\n\n" +
          value.findings
            .map(
              (f) => `## ${f.heading}\n\n> ${f.quote}\n\nSource: ${f.sourceId}`,
            )
            .join("\n\n"),
      },
    ];
    checks = [
      "Every quotation matches the supplied source exactly",
      "Source references resolved",
    ];
  } else if (service.type === "plan") {
    bounded(value?.title, 200);
    if (
      !Array.isArray(value.sections) ||
      value.sections.length < 3 ||
      value.sections.length > 8 ||
      !Array.isArray(value.evidence) ||
      !value.evidence.length ||
      !Array.isArray(value.assumptions) ||
      value.assumptions.length > 12
    )
      throw Error("Incomplete professional plan");
    value.sections.forEach((s) => {
      bounded(s.heading, 200);
      bounded(s.body, 5000);
    });
    value.evidence.forEach((e) => {
      bounded(e.quote, 1000);
      if (!input.includes(e.quote))
        throw Error("Planning evidence quote not in supplied brief");
    });
    value.assumptions.forEach((a) => bounded(a, 700));
    files = [
      {
        filename: "plan.md",
        contentType: "text/markdown",
        content: `# ${value.title}\n\n${value.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join("\n\n")}\n\n## Evidence from supplied inputs\n\n${value.evidence.map((e) => "> " + e.quote).join("\n\n")}\n\n## Assumptions and unresolved questions\n\n${value.assumptions.join("\n\n") || "No additional assumptions supplied."}\n\nDigital planning only. No physical service was performed. Customer review is required.`,
      },
    ];
    checks = [
      "Required plan sections exist",
      "Supporting input quotations verified",
      "Assumptions and planning-only scope disclosed",
    ];
  } else if (service.type === "website") {
    bounded(value?.title, 150);
    bounded(value.subtitle, 500);
    bounded(value.callToAction, 120);
    if (
      !/^#[a-f0-9]{6}$/i.test(value.color) ||
      !Array.isArray(value.sections) ||
      value.sections.length < 3 ||
      value.sections.length > 8
    )
      throw Error("Invalid website content");
    value.sections.forEach((s) => {
      bounded(s.heading, 150);
      bounded(s.body, 2500);
      if (
        /<!doctype|<html[\s>]|```(?:html|css|javascript)|MESSAGE_BEGIN/i.test(
          s.body,
        )
      )
        throw Error(
          "Website requires final visitor-facing copy, not embedded source code or delivery transcripts",
        );
    });
    const contrast = contrastRatio(value.color, "#faf7ef");
    if (contrast < 4.5)
      throw Error(
        "Website accent fails measured WCAG AA text contrast against the actual template background",
      );
    const content = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${escape(value.title)}</title><style>*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#faf7ef;color:#243b32;font:18px/1.7 system-ui}header,main,footer{max-width:1080px;margin:auto;padding:48px 28px}header{padding-top:96px}h1{font:clamp(40px,8vw,88px)/1.1 Georgia}h2{font:32px Georgia}a{color:${value.color}}.cta{display:inline-block;border:2px solid ${value.color};padding:12px 24px;border-radius:30px}section{padding:32px 0;border-top:1px solid #ddd}p{max-width:70ch;white-space:pre-wrap}footer{font-size:14px}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}</style></head><body><header><p>INDEPENDENT BUSINESS</p><h1>${escape(value.title)}</h1><p>${escape(value.subtitle)}</p><a class="cta" href="#contact">${escape(value.callToAction)}</a></header><main>${value.sections.map((s) => `<section><h2>${escape(s.heading)}</h2><p>${escape(s.body)}</p></section>`).join("")}<section id="contact"><h2>Next steps</h2><p>This static website is ready for your review. Add verified contact details before publishing.</p></section></main><footer>Built by an Econia professional. Static deliverable; no order processing or physical fulfillment is enabled.</footer></body></html>`;
    files = [{ filename: "index.html", contentType: "text/html", content }];
    checks = [
      "HTML generated by trusted template",
      "All model content escaped",
      "No executable model code or remote resources",
      "Responsive semantic page with keyboard navigation",
      "Measured accent/background contrast ratio: " +
        contrast.toFixed(2) +
        ":1",
    ];
  } else if (service.type === "design") {
    bounded(value?.title, 150);
    bounded(value.typography, 500);
    if (
      !Array.isArray(value.palette) ||
      value.palette.length < 3 ||
      value.palette.length > 5 ||
      value.palette.some((c) => !/^#[a-f0-9]{6}$/i.test(c)) ||
      !Array.isArray(value.principles) ||
      value.principles.length < 2 ||
      value.principles.length > 8
    )
      throw Error("Invalid visual specification");
    value.principles.forEach((p) => bounded(p, 500));
    const content = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="520" viewBox="0 0 1000 520"><rect width="1000" height="520" fill="#f7f4eb"/><text x="48" y="86" font-family="Georgia,serif" font-size="38" fill="#243b32">${escape(value.title)}</text>${value.palette.map((c, i) => `<rect x="${48 + i * 180}" y="140" width="156" height="210" rx="16" fill="${c}"/><text x="${48 + i * 180}" y="385" font-family="sans-serif" font-size="20" fill="#243b32">${c}</text>`).join("")}<text x="48" y="460" font-family="sans-serif" font-size="18" fill="#243b32">Econia • Original structured style board • Review before use</text></svg>`;
    files = [
      { filename: "style-board.svg", contentType: "image/svg+xml", content },
      {
        filename: "design.md",
        contentType: "text/markdown",
        content: `# ${value.title}\n\nPalette: ${value.palette.join(", ")}\n\nTypography: ${value.typography}\n\n${value.principles.join("\n\n")}`,
      },
    ];
    checks = [
      "Palette values validated",
      "SVG created by trusted local renderer",
      "No scripts, external links or model-generated XML executed",
    ];
  }
  return {
    files: files.map((f) => ({ ...f, sha256: hash(f.content) })),
    checks,
  };
}
