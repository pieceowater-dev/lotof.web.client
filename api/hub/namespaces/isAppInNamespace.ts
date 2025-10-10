import { hubClient, setGlobalAuthToken } from '@/api/clients';

type InstalledMap = Record<string, boolean>; // key: appBundle

// Build a single GraphQL query with aliases for each app bundle
function buildIsAppsInNamespaceQuery(appBundles: string[]) {
  // Ensure unique, GraphQL-safe aliases
  const aliasByBundle = new Map<string, string>();
  const usedAliases = new Set<string>();

  function makeAlias(bundle: string, idx: number) {
    // Start with a letter and replace non [A-Za-z0-9_] with _
    let base = 'a_' + bundle.replace(/[^A-Za-z0-9_]/g, '_');
    if (!/^[A-Za-z_]/.test(base)) base = 'a_' + base;
    let alias = base;
    while (usedAliases.has(alias)) alias = `${base}_${idx}`;
    usedAliases.add(alias);
    return alias;
  }

  const fieldLines: string[] = [];
  appBundles.forEach((bundle, idx) => {
    const alias = makeAlias(bundle, idx);
    aliasByBundle.set(bundle, alias);
    // Use a literal for appBundle to avoid declaring N variables
    const bundleLiteral = JSON.stringify(bundle);
    fieldLines.push(`  ${alias}: isAppInNamespace(namespaceSlug: $namespaceSlug, appBundle: ${bundleLiteral}) {\n    id\n    namespaceID\n    appBundle\n  }`);
  });

  const query = `\n  query IsAppsInNamespace($namespaceSlug: String!) {\n${fieldLines.join('\n')}\n  }\n`;
  return { query, aliasByBundle };
}

export async function hubAreAppsInNamespace(token: string, namespaceSlug: string, appBundles: string[]): Promise<InstalledMap> {
  const result: InstalledMap = {};
  if (!appBundles.length) return result;
  setGlobalAuthToken(token);
  const { query, aliasByBundle } = buildIsAppsInNamespaceQuery(appBundles);
  try {
    const data = await hubClient.request<any>(/* GraphQL */ query, { namespaceSlug });
    for (const [bundle, alias] of aliasByBundle.entries()) {
      result[bundle] = !!data?.[alias]?.id;
    }
    return result;
  } catch (err: any) {
    // GraphQL servers often return partial data with errors; graphql-request throws but keeps data at err.response.data
    const data = err?.response?.data;
    if (data && typeof data === 'object') {
      for (const [bundle, alias] of aliasByBundle.entries()) {
        result[bundle] = !!data?.[alias]?.id;
      }
      // Default any missing entries to false
      for (const b of appBundles) if (result[b] === undefined) result[b] = false;
      return result;
    }
    // On any other failure, default to false for all to avoid blocking UX
    for (const b of appBundles) result[b] = false;
    return result;
  }
}

// Backwards-compatible single-check wrapper
export async function hubIsAppInNamespace(token: string, namespaceSlug: string, appBundle: string): Promise<boolean> {
  const map = await hubAreAppsInNamespace(token, namespaceSlug, [appBundle]);
  return !!map[appBundle];
}
