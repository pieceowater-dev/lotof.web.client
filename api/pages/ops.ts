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
  logoUrl: string; footerText: string;
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
}
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
export interface SiteMedia { id: string; siteId: string; sha256: string; ext: string; width: number; height: number; bytes: number; alt: string; url: string; createdAtUnix: number }

const SETTINGS_FIELDS = `defaultLang langs faviconUrl ogImageUrl googleSiteVerification robotsTxt headHtml themeId themeVarsJson navJson logoUrl footerText`;
const SITE_FIELDS = `id name slug status publishedVersion pageCount createdAtUnix updatedAtUnix host platformHost settings { ${SETTINGS_FIELDS} }`;
const SEO_FIELDS = `title description canonicalPath ogTitle ogDescription ogImageUrl noindex schemaType`;
const PAGE_LIST_FIELDS = `id siteId parentId slug path title status sort lang updatedAtUnix`;
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
  pages: (ns: string, siteId: string, search?: string) =>
    q<{ pages: { rows: SitePage[] } }>(ns, `query($s:ID!,$q:String,$f:DefaultFilterInput){ pages(siteId:$s,search:$q,filter:$f){ rows { ${PAGE_LIST_FIELDS} } } }`, { s: siteId, q: search || null, f: FILTER_ALL }).then(r => r.pages.rows),
  page: (ns: string, id: string) =>
    q<{ page: SitePage | null }>(ns, `query($id:ID!){ page(id:$id){ ${PAGE_FIELDS} } }`, { id }).then(r => r.page),
  createPage: (ns: string, input: { siteId: string; parentId?: string | null; slug: string; title: string; lang?: string }) =>
    q<{ createPage: SitePage }>(ns, `mutation($i:CreatePageInput!){ createPage(input:$i){ ${PAGE_FIELDS} } }`, { i: input }).then(r => r.createPage),
  updatePage: (ns: string, input: {
    id: string; slug: string; title: string; status: PageStatus; lang?: string;
    seo?: Partial<PageSeo>; blocks: { id: string; type: string; content: string; attrsJson?: string }[];
  }) =>
    q<{ updatePage: SitePage }>(ns, `mutation($i:UpdatePageInput!){ updatePage(input:$i){ ${PAGE_FIELDS} } }`, { i: input }).then(r => r.updatePage),
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
