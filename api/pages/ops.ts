import { pagesClient } from '@/api/clients';
import { pagesRequestWithRefresh } from '@/api/pages/pagesRequestWithRefresh';
import { buildGraphqlUploadBody } from '@/utils/graphqlMultipartUpload';
import { getApiBaseUrl } from '@/utils/api-base';

// --- shapes (the gateway is authoritative) ---
export type SiteStatus = 'SITE_DRAFT' | 'SITE_PUBLISHED' | 'SITE_SUSPENDED';
export type PageStatus = 'PAGE_DRAFT' | 'PAGE_READY' | 'PAGE_ARCHIVED';

export interface SiteSettings {
  defaultLang: string; langs: string[]; faviconUrl: string; ogImageUrl: string; googleSiteVerification: string;
  robotsTxt: string; headHtml: string; themeId: string; themeVarsJson: string; navJson: string;
  logoUrl: string; footerText: string; footHtml: string; customCss: string; floatJson: string;
}
export interface PagesSite {
  id: string; name: string; slug: string; status: SiteStatus; settings: SiteSettings;
  publishedVersion: string; pageCount: number; createdAtUnix: number; updatedAtUnix: number; host: string; platformHost: string;
}
export interface PageBlock { id: string; type: string; content: string; attrsJson: string }
export interface PageSeo {
  title: string; description: string; canonicalPath: string; ogTitle: string; ogDescription: string;
  ogImageUrl: string; noindex: boolean; schemaType: string;
}
export interface SitePage {
  id: string; siteId: string; parentId: string | null; slug: string; path: string; title: string; status: PageStatus;
  seo: PageSeo; blocks: PageBlock[]; schemaVersion: number; sort: number; lang: string; createdAtUnix: number; updatedAtUnix: number;
  categoryIds: string[];
  translationGroup: string;
}
export interface SiteCategory { id: string; siteId: string; parentId: string | null; slug: string; title: string; description: string; sort: number; pageCount: number }
export interface CategoryInput { parentId?: string | null; slug?: string; title: string; description?: string; sort?: number }
export interface PageRevision { id: string; pageId: string; authorId: string; createdAtUnix: number }
export interface SiteVersion {
  id: string; siteId: string; version: string; pageCount: number; bytes: number; createdBy: string; note: string; live: boolean; createdAtUnix: number;
}
export interface PreflightIssue { severity: 'error' | 'warning'; code: string; pagePath: string; message: string }
export interface PreflightResult { ok: boolean; issues: PreflightIssue[] }
export interface SiteRedirect { id: string; siteId: string; fromPath: string; toPath: string; code: number; source: string }
export type DomainStatus = 'DOMAIN_PENDING_DNS' | 'DOMAIN_DNS_VERIFIED' | 'DOMAIN_TLS_PROVISIONING' | 'DOMAIN_ACTIVE' | 'DOMAIN_TLS_FAILED' | 'DOMAIN_MISCONFIGURED' | 'DOMAIN_SUSPENDED';
export interface DnsRecord { type: string; name: string; value: string; done: boolean; purpose: 'ownership' | 'routing' | string }
export interface SiteDomain {
  id: string; siteId: string; hostname: string; displayHostname: string; isPrimary: boolean; status: DomainStatus; isApex: boolean;
  records: DnsRecord[]; lastError: string; lastCheckedAtUnix: number; activatedAtUnix: number; createdAtUnix: number; suspendAtUnix: number;
}
export interface SiteDomains { domains: SiteDomain[]; platformHost: string; primaryHost: string; cnameTarget: string; ips: string[] }
export type AccessScope = 'read' | 'write' | 'publish';
export interface AccessToken {
  id: string; name: string; prefix: string; scopes: AccessScope[]; siteId: string;
  expiresAtUnix: number; lastUsedAtUnix: number; createdAtUnix: number; revoked: boolean;
}
export type PagesRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'NONE';
export interface PagesAccess { role: PagesRole; allSites: boolean; siteIds: string[] }
export interface PagesStaffMember { id: string; userId: string; role: 'ADMIN' | 'EDITOR'; allSites: boolean; siteIds: string[]; createdAtUnix: number }
export interface GlobalBlock { id: string; siteId: string; slug: string; name: string; markdown: string; usedBy: number; updatedAtUnix: number }
export interface SiteMedia { id: string; siteId: string; sha256: string; ext: string; width: number; height: number; bytes: number; alt: string; url: string; createdAtUnix: number }

const SETTINGS_FIELDS = `defaultLang langs faviconUrl ogImageUrl googleSiteVerification robotsTxt headHtml themeId themeVarsJson navJson logoUrl footerText footHtml customCss floatJson`;
const SITE_FIELDS = `id name slug status publishedVersion pageCount createdAtUnix updatedAtUnix host platformHost settings { ${SETTINGS_FIELDS} }`;
const SEO_FIELDS = `title description canonicalPath ogTitle ogDescription ogImageUrl noindex schemaType`;
const PAGE_LIST_FIELDS = `id siteId parentId slug path title status sort lang updatedAtUnix categoryIds translationGroup`;
const PAGE_FIELDS = `${PAGE_LIST_FIELDS} createdAtUnix schemaVersion seo { ${SEO_FIELDS} } blocks { id type content attrsJson }`;
const VERSION_FIELDS = `id siteId version pageCount bytes createdBy note live createdAtUnix`;
const DOMAIN_FIELDS = `id siteId hostname displayHostname isPrimary status isApex lastError lastCheckedAtUnix activatedAtUnix createdAtUnix suspendAtUnix records { type name value done purpose }`;
const FILTER_ALL = { pagination: { page: 1, length: 'ONE_HUNDRED' } };

function q<T>(ns: string, doc: string, vars?: Record<string, any>): Promise<T> {
  return pagesRequestWithRefresh(() => pagesClient.request<T>(doc, vars || {}), ns);
}

export const pagesApi = {
  // sites
  sites: (ns: string) =>
    q<{ sites: { rows: PagesSite[] } }>(ns, `query($f:DefaultFilterInput){ sites(filter:$f){ rows { ${SITE_FIELDS} } } }`, { f: FILTER_ALL }).then(r => r.sites.rows),
  site: (ns: string, id: string) =>
    q<{ site: PagesSite | null }>(ns, `query($id:ID!){ site(id:$id){ ${SITE_FIELDS} } }`, { id }).then(r => r.site),
  createSite: (ns: string, input: { name: string; slug: string }) =>
    q<{ createSite: PagesSite }>(ns, `mutation($i:CreateSiteInput!){ createSite(input:$i){ ${SITE_FIELDS} } }`, { i: input }).then(r => r.createSite),
  updateSite: (ns: string, input: { id: string; name: string; settings?: Partial<SiteSettings> }) =>
    q<{ updateSite: PagesSite }>(ns, `mutation($i:UpdateSiteInput!){ updateSite(input:$i){ ${SITE_FIELDS} } }`, { i: input }).then(r => r.updateSite),
  setSuspended: (ns: string, id: string, suspended: boolean) =>
    q<{ setSiteSuspended: PagesSite }>(ns, `mutation($id:ID!,$s:Boolean!){ setSiteSuspended(id:$id,suspended:$s){ ${SITE_FIELDS} } }`, { id, s: suspended }).then(r => r.setSiteSuspended),
  deleteSite: (ns: string, id: string) =>
    q<{ deleteSite: { success: boolean } }>(ns, `mutation($id:ID!){ deleteSite(id:$id){ success } }`, { id }).then(r => r.deleteSite.success),

  // pages
  // Every page of a site (the API caps one request at 100 rows, so walk the pages).
  pages: async (ns: string, siteId: string, search?: string) => {
    const out: SitePage[] = [];
    for (let page = 1; page <= 50; page++) {
      const r = await q<{ pages: { rows: SitePage[] } }>(ns, `query($s:ID!,$q:String,$f:DefaultFilterInput){ pages(siteId:$s,search:$q,filter:$f){ rows { ${PAGE_LIST_FIELDS} } } }`, { s: siteId, q: search || null, f: { pagination: { page, length: 'ONE_HUNDRED' } } });
      out.push(...r.pages.rows);
      if (r.pages.rows.length < 100) break;
    }
    return out;
  },
  /** One page of results for pickers: server-side search + paging. */
  pagesPage: (ns: string, siteId: string, opts: { search?: string; page: number; length?: 'TEN' | 'TWENTY' | 'FIFTY' }) =>
    q<{ pages: { rows: SitePage[]; info: { count: number } } }>(ns, `query($s:ID!,$q:String,$f:DefaultFilterInput){ pages(siteId:$s,search:$q,filter:$f){ rows { ${PAGE_LIST_FIELDS} } info { count } } }`,
      { s: siteId, q: opts.search || null, f: { pagination: { page: opts.page, length: opts.length || 'TWENTY' } } }).then(r => r.pages),
  page: (ns: string, id: string) =>
    q<{ page: SitePage | null }>(ns, `query($id:ID!){ page(id:$id){ ${PAGE_FIELDS} } }`, { id }).then(r => r.page),
  createPage: (ns: string, input: { siteId: string; parentId?: string | null; slug: string; title: string; lang?: string }) =>
    q<{ createPage: SitePage }>(ns, `mutation($i:CreatePageInput!){ createPage(input:$i){ ${PAGE_FIELDS} } }`, { i: input }).then(r => r.createPage),
  updatePage: (ns: string, input: {
    id: string; slug: string; title: string; status: PageStatus; lang?: string;
    seo?: Partial<PageSeo>; blocks: { id: string; type: string; content: string; attrsJson?: string }[];
    /** Omit to keep the page's categories; [] clears them. */
    categoryIds?: string[];
  }) =>
    q<{ updatePage: SitePage }>(ns, `mutation($i:UpdatePageInput!){ updatePage(input:$i){ ${PAGE_FIELDS} } }`, { i: input }).then(r => r.updatePage),
  pageTranslations: (ns: string, pageId: string) =>
    q<{ pageTranslations: SitePage[] }>(ns, `query($p:ID!){ pageTranslations(pageId:$p){ ${PAGE_LIST_FIELDS} } }`, { p: pageId }).then(r => r.pageTranslations),
  createPageTranslation: (ns: string, pageId: string, lang: string) =>
    q<{ createPageTranslation: SitePage }>(ns, `mutation($p:ID!,$l:String!){ createPageTranslation(pageId:$p,lang:$l){ ${PAGE_LIST_FIELDS} } }`, { p: pageId, l: lang }).then(r => r.createPageTranslation),
  unlinkPageTranslation: (ns: string, pageId: string) =>
    q<{ unlinkPageTranslation: SitePage }>(ns, `mutation($p:ID!){ unlinkPageTranslation(pageId:$p){ ${PAGE_LIST_FIELDS} } }`, { p: pageId }).then(r => r.unlinkPageTranslation),
  setPageCategories: (ns: string, pageId: string, categoryIds: string[]) =>
    q<{ setPageCategories: SitePage }>(ns, `mutation($p:ID!,$c:[ID!]!){ setPageCategories(pageId:$p,categoryIds:$c){ ${PAGE_FIELDS} } }`, { p: pageId, c: categoryIds }).then(r => r.setPageCategories),
  movePage: (ns: string, id: string, parentId: string | null, sort: number) =>
    q<{ movePage: SitePage }>(ns, `mutation($id:ID!,$p:ID,$s:Int!){ movePage(id:$id,parentId:$p,sort:$s){ ${PAGE_LIST_FIELDS} } }`, { id, p: parentId, s: sort }).then(r => r.movePage),
  deletePage: (ns: string, id: string) =>
    q<{ deletePage: { success: boolean } }>(ns, `mutation($id:ID!){ deletePage(id:$id){ success } }`, { id }).then(r => r.deletePage.success),
  revisions: (ns: string, pageId: string) =>
    q<{ pageRevisions: { rows: PageRevision[] } }>(ns, `query($p:ID!,$f:DefaultFilterInput){ pageRevisions(pageId:$p,filter:$f){ rows { id pageId authorId createdAtUnix } } }`, { p: pageId, f: FILTER_ALL }).then(r => r.pageRevisions.rows),
  restoreRevision: (ns: string, revisionId: string) =>
    q<{ restorePageRevision: SitePage }>(ns, `mutation($r:ID!){ restorePageRevision(revisionId:$r){ ${PAGE_FIELDS} } }`, { r: revisionId }).then(r => r.restorePageRevision),

  // publishing
  preflight: (ns: string, siteId: string) =>
    q<{ preflightSite: PreflightResult }>(ns, `query($s:ID!){ preflightSite(siteId:$s){ ok issues { severity code pagePath message } } }`, { s: siteId }).then(r => r.preflightSite),
  publish: (ns: string, siteId: string, note?: string) =>
    q<{ publishSite: SiteVersion }>(ns, `mutation($s:ID!,$n:String){ publishSite(siteId:$s,note:$n){ ${VERSION_FIELDS} } }`, { s: siteId, n: note || null }).then(r => r.publishSite),
  versions: (ns: string, siteId: string) =>
    q<{ siteVersions: { rows: SiteVersion[] } }>(ns, `query($s:ID!,$f:DefaultFilterInput){ siteVersions(siteId:$s,filter:$f){ rows { ${VERSION_FIELDS} } } }`, { s: siteId, f: FILTER_ALL }).then(r => r.siteVersions.rows),
  rollback: (ns: string, siteId: string, version: string) =>
    q<{ rollbackSite: SiteVersion }>(ns, `mutation($s:ID!,$v:String!){ rollbackSite(siteId:$s,version:$v){ ${VERSION_FIELDS} } }`, { s: siteId, v: version }).then(r => r.rollbackSite),

  // custom domains
  domains: (ns: string, siteId: string) =>
    q<{ siteDomains: SiteDomains }>(ns, `query($s:ID!){ siteDomains(siteId:$s){ platformHost primaryHost cnameTarget ips domains { ${DOMAIN_FIELDS} } } }`, { s: siteId }).then(r => r.siteDomains),
  addDomain: (ns: string, siteId: string, hostname: string) =>
    q<{ addSiteDomain: SiteDomain }>(ns, `mutation($s:ID!,$h:String!){ addSiteDomain(siteId:$s,hostname:$h){ ${DOMAIN_FIELDS} } }`, { s: siteId, h: hostname }).then(r => r.addSiteDomain),
  checkDomain: (ns: string, id: string) =>
    q<{ checkSiteDomain: SiteDomain }>(ns, `mutation($id:ID!){ checkSiteDomain(id:$id){ ${DOMAIN_FIELDS} } }`, { id }).then(r => r.checkSiteDomain),
  setPrimaryDomain: (ns: string, siteId: string, hostname: string) =>
    q<{ setPrimaryDomain: SiteDomain }>(ns, `mutation($s:ID!,$h:String!){ setPrimaryDomain(siteId:$s,hostname:$h){ ${DOMAIN_FIELDS} } }`, { s: siteId, h: hostname }).then(r => r.setPrimaryDomain),
  removeDomain: (ns: string, id: string) =>
    q<{ removeSiteDomain: { success: boolean } }>(ns, `mutation($id:ID!){ removeSiteDomain(id:$id){ success } }`, { id }).then(r => r.removeSiteDomain.success),

  // categories
  categories: (ns: string, siteId: string) =>
    q<{ categories: SiteCategory[] }>(ns, `query($s:ID!){ categories(siteId:$s){ id siteId parentId slug title description sort pageCount } }`, { s: siteId }).then(r => r.categories),
  createCategory: (ns: string, siteId: string, input: CategoryInput) =>
    q<{ createCategory: SiteCategory }>(ns, `mutation($s:ID!,$i:CategoryInput!){ createCategory(siteId:$s,input:$i){ id siteId parentId slug title description sort pageCount } }`, { s: siteId, i: input }).then(r => r.createCategory),
  updateCategory: (ns: string, id: string, input: CategoryInput) =>
    q<{ updateCategory: SiteCategory }>(ns, `mutation($id:ID!,$i:CategoryInput!){ updateCategory(id:$id,input:$i){ id siteId parentId slug title description sort pageCount } }`, { id, i: input }).then(r => r.updateCategory),
  deleteCategory: (ns: string, id: string) =>
    q<{ deleteCategory: { success: boolean } }>(ns, `mutation($id:ID!){ deleteCategory(id:$id){ success } }`, { id }).then(r => r.deleteCategory.success),

  // team (owner only) and the caller's own access
  myAccess: (ns: string) =>
    q<{ myPagesAccess: PagesAccess }>(ns, `query{ myPagesAccess { role allSites siteIds } }`).then(r => r.myPagesAccess),
  staff: (ns: string) =>
    q<{ pagesStaff: PagesStaffMember[] }>(ns, `query{ pagesStaff { id userId role allSites siteIds createdAtUnix } }`).then(r => r.pagesStaff),
  upsertStaff: (ns: string, input: { userId: string; role: 'ADMIN' | 'EDITOR'; allSites: boolean; siteIds: string[] }) =>
    q<{ upsertPagesStaff: PagesStaffMember }>(ns, `mutation($u:String!,$r:PagesStaffRole!,$a:Boolean!,$s:[ID!]){ upsertPagesStaff(userId:$u,role:$r,allSites:$a,siteIds:$s){ id userId role allSites siteIds createdAtUnix } }`, { u: input.userId, r: input.role, a: input.allSites, s: input.siteIds }).then(r => r.upsertPagesStaff),
  removeStaff: (ns: string, userId: string) =>
    q<{ removePagesStaff: { success: boolean } }>(ns, `mutation($u:String!){ removePagesStaff(userId:$u){ success } }`, { u: userId }).then(r => r.removePagesStaff.success),

  // global (reusable) blocks
  globalBlocks: (ns: string, siteId: string) =>
    q<{ globalBlocks: GlobalBlock[] }>(ns, `query($s:ID!){ globalBlocks(siteId:$s){ id siteId slug name markdown usedBy updatedAtUnix } }`, { s: siteId }).then(r => r.globalBlocks),
  createGlobalBlock: (ns: string, siteId: string, input: { name: string; slug?: string; markdown: string }) =>
    q<{ createGlobalBlock: GlobalBlock }>(ns, `mutation($s:ID!,$i:GlobalBlockInput!){ createGlobalBlock(siteId:$s,input:$i){ id siteId slug name markdown usedBy updatedAtUnix } }`, { s: siteId, i: input }).then(r => r.createGlobalBlock),
  updateGlobalBlock: (ns: string, id: string, input: { name: string; slug?: string; markdown: string }) =>
    q<{ updateGlobalBlock: GlobalBlock }>(ns, `mutation($id:ID!,$i:GlobalBlockInput!){ updateGlobalBlock(id:$id,input:$i){ id siteId slug name markdown usedBy updatedAtUnix } }`, { id, i: input }).then(r => r.updateGlobalBlock),
  deleteGlobalBlock: (ns: string, id: string) =>
    q<{ deleteGlobalBlock: { success: boolean } }>(ns, `mutation($id:ID!){ deleteGlobalBlock(id:$id){ success } }`, { id }).then(r => r.deleteGlobalBlock.success),

  // access tokens (MCP and other external clients)
  accessTokens: (ns: string) =>
    q<{ accessTokens: AccessToken[] }>(ns, `query{ accessTokens { id name prefix scopes siteId expiresAtUnix lastUsedAtUnix createdAtUnix revoked } }`).then(r => r.accessTokens),
  createAccessToken: (ns: string, input: { name: string; scopes: AccessScope[]; siteId?: string; expiresAtUnix?: number }) =>
    q<{ createAccessToken: { secret: string; token: AccessToken } }>(ns, `mutation($n:String!,$s:[AccessScope!]!,$site:ID,$e:Int){ createAccessToken(name:$n,scopes:$s,siteId:$site,expiresAtUnix:$e){ secret token { id name prefix scopes siteId expiresAtUnix lastUsedAtUnix createdAtUnix revoked } } }`, { n: input.name, s: input.scopes, site: input.siteId || null, e: input.expiresAtUnix || null }).then(r => r.createAccessToken),
  revokeAccessToken: (ns: string, id: string) =>
    q<{ revokeAccessToken: { success: boolean } }>(ns, `mutation($id:ID!){ revokeAccessToken(id:$id){ success } }`, { id }).then(r => r.revokeAccessToken.success),

  // redirects
  redirects: (ns: string, siteId: string) =>
    q<{ redirects: { rows: SiteRedirect[] } }>(ns, `query($s:ID!,$f:DefaultFilterInput){ redirects(siteId:$s,filter:$f){ rows { id siteId fromPath toPath code source } } }`, { s: siteId, f: FILTER_ALL }).then(r => r.redirects.rows),
  upsertRedirect: (ns: string, input: { siteId: string; fromPath: string; toPath: string; code?: number }) =>
    q<{ upsertRedirect: SiteRedirect }>(ns, `mutation($i:UpsertRedirectInput!){ upsertRedirect(input:$i){ id siteId fromPath toPath code source } }`, { i: input }).then(r => r.upsertRedirect),
  deleteRedirect: (ns: string, id: string) =>
    q<{ deleteRedirect: { success: boolean } }>(ns, `mutation($id:ID!){ deleteRedirect(id:$id){ success } }`, { id }).then(r => r.deleteRedirect.success),
  importRedirects: (ns: string, siteId: string, csv: string) =>
    q<{ importRedirectsCsv: { imported: number; errors: string[] } }>(ns, `mutation($s:ID!,$c:String!){ importRedirectsCsv(siteId:$s,csv:$c){ imported errors } }`, { s: siteId, c: csv }).then(r => r.importRedirectsCsv),
};
