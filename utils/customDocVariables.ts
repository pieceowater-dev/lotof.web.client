// The tenant's own document variables (company details, bank, terms …): a
// name → text map stored in the brand's order rules and used as {{NAME}} in
// document templates, next to the built-in order/client/branch variables.

export type CustomDocVariables = Record<string, string>;

export const CUSTOM_VAR_NAME_RE = /^[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ0-9_]{1,40}$/;

export function parseCustomDocVariables(orderRules?: string | null): CustomDocVariables {
  try {
    const rules = JSON.parse(orderRules || '{}');
    const raw = rules?.docVariables;
    if (!raw || typeof raw !== 'object') return {};
    const out: CustomDocVariables = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') out[k] = v;
    return out;
  } catch {
    return {};
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces {{NAME}} (any case) with the variable's text; unknown tokens are left untouched. */
export function applyCustomDocVariables(html: string, vars: CustomDocVariables): string {
  let out = html;
  for (const [name, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${escapeRe(name)}\\s*\\}\\}`, 'gi'), () => escapeHtml(value).replace(/\n/g, '<br>'));
  }
  return out;
}
