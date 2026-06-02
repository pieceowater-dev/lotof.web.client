import { capitalClient, setGlobalAuthToken } from '@/api/clients'

export type PublicationCategory = 'blog' | 'whatsnew' | 'articles' | 'learning' | 'news'
export type PublicationStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'
export type PublicationVisibility = 'public' | 'unlisted' | 'private'
export type PublicationSchemaType = 'Article' | 'NewsArticle' | 'BlogPosting'

export type PublicationEditorBlock = {
  id: string
  type: string
  content: string
  attrs: Record<string, any>
}

export type PublicationEditorArticle = {
  title: string
  slug: string
  status: 'draft' | 'published' | 'archived'
  category: PublicationCategory | string
  author: string
  authorUrl: string
  authorRole: string
  publishedAt: string
  updatedAt: string
  featuredImage: string
  tags: string[]
  focusKeyword: string
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  ogImage: string
  schemaType: PublicationSchemaType
  sourceUrl: string
  sourceName: string
  reviewedBy: string
  reviewedByUrl: string
  reviewedDate: string
  publisherName: string
  publisherUrl: string
  publisherLogo: string
  robots: string
  version?: string
  currentRevision?: string
}

export type PublicationListRow = {
  id: string
  title: string
  slug: string
  category: PublicationCategory
  status: 'draft' | 'published'
  visibility: PublicationVisibility
  excerpt: string
  author: string
  publishedAt: string
  updatedAt: string
  scheduledAt: string
  version: string
}

export type PublicationListPayload = {
  items: PublicationListRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  counts: Record<string, number>
}

type GraphQLPublicationBlock = {
  id: string
  type: string
  content: string
  attrsJson: string
}

type GraphQLPublication = {
  id: string
  title: string
  slug: string
  category: string
  status: string
  visibility: string
  excerpt: string
  author: string
  authorUrl: string
  authorRole: string
  publishedAtUnix: string
  scheduledAtUnix: string
  featuredImage: string
  tags: string[]
  focusKeyword: string
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  ogImage: string
  schemaType: string
  sourceUrl: string
  sourceName: string
  reviewedBy: string
  reviewedByUrl: string
  reviewedDateUnix: string
  publisherName: string
  publisherUrl: string
  publisherLogo: string
  robots: string
  currentRevision: string
  version: string
  blocks: GraphQLPublicationBlock[]
  createdAtUnix: string
  updatedAtUnix: string
}

type GraphQLPublicPublication = {
  id: string
  title: string
  slug: string
  category: string
  excerpt: string
  author: string
  authorUrl: string
  authorRole: string
  publishedAtUnix: string
  tags: string[]
  canonicalUrl: string
  ogImage: string
  schemaType: string
  sourceUrl: string
  sourceName: string
  reviewedBy: string
  reviewedByUrl: string
  reviewedDateUnix: string
  publisherName: string
  publisherUrl: string
  publisherLogo: string
  robots: string
  blocks: GraphQLPublicationBlock[]
  createdAtUnix: string
  updatedAtUnix: string
}

const PUBLICATION_CATEGORY_ALIASES: Record<string, PublicationCategory> = {
  blog: 'blog',
  whatsnew: 'whatsnew',
  articles: 'articles',
  learning: 'learning',
  news: 'news',
}

const CATEGORY_TO_GQL: Record<PublicationCategory, string> = {
  blog: 'BLOG',
  whatsnew: 'WHATSNEW',
  articles: 'ARTICLES',
  learning: 'LEARNING',
  news: 'NEWS',
}

const GQL_TO_CATEGORY: Record<string, PublicationCategory> = {
  BLOG: 'blog',
  WHATSNEW: 'whatsnew',
  ARTICLES: 'articles',
  LEARNING: 'learning',
  NEWS: 'news',
}

const STATUS_TO_GQL: Record<PublicationStatus, string> = {
  draft: 'DRAFT',
  in_review: 'IN_REVIEW',
  scheduled: 'SCHEDULED',
  published: 'PUBLISHED',
  archived: 'ARCHIVED',
}

const GQL_TO_STATUS: Record<string, PublicationStatus> = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
}

const VISIBILITY_TO_GQL: Record<PublicationVisibility, string> = {
  public: 'PUBLIC',
  unlisted: 'UNLISTED',
  private: 'PRIVATE',
}

const GQL_TO_VISIBILITY: Record<string, PublicationVisibility> = {
  PUBLIC: 'public',
  UNLISTED: 'unlisted',
  PRIVATE: 'private',
}

const SCHEMA_TYPE_TO_GQL: Record<PublicationSchemaType, string> = {
  Article: 'ARTICLE',
  NewsArticle: 'NEWS_ARTICLE',
  BlogPosting: 'BLOG_POSTING',
}

const GQL_TO_SCHEMA_TYPE: Record<string, PublicationSchemaType> = {
  ARTICLE: 'Article',
  NEWS_ARTICLE: 'NewsArticle',
  BLOG_POSTING: 'BlogPosting',
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

const CONSOLE_PUBLICATIONS_QUERY = /* GraphQL */ `
  query ConsolePublications($filter: PublicationListFilterInput) {
    consolePublications(filter: $filter) {
      items {
        id
        title
        slug
        category
        status
        visibility
        excerpt
        author
        publishedAtUnix
        scheduledAtUnix
        updatedAtUnix
        version
      }
      total
      page
      pageSize
      totalPages
      counts {
        all
        blog
        whatsnew
        articles
        learning
        news
      }
    }
  }
`

const CONSOLE_PUBLICATION_BY_SLUG_QUERY = /* GraphQL */ `
  query ConsolePublicationBySlug($slug: String!, $includeBlocks: Boolean = true) {
    consolePublicationBySlug(slug: $slug, includeBlocks: $includeBlocks) {
      id
      title
      slug
      category
      status
      visibility
      excerpt
      author
      authorUrl
      authorRole
      publishedAtUnix
      scheduledAtUnix
      featuredImage
      tags
      focusKeyword
      metaTitle
      metaDescription
      canonicalUrl
      ogImage
      schemaType
      sourceUrl
      sourceName
      reviewedBy
      reviewedByUrl
      reviewedDateUnix
      publisherName
      publisherUrl
      publisherLogo
      robots
      currentRevision
      version
      blocks @include(if: $includeBlocks) {
        id
        type
        content
        attrsJson
      }
      createdAtUnix
      updatedAtUnix
    }
  }
`

const PUBLIC_PUBLICATION_BY_ROUTE_QUERY = /* GraphQL */ `
  query PublicPublicationByRoute($category: PublicationCategory!, $slug: String!, $includeBlocks: Boolean = true) {
    publicPublicationByRoute(category: $category, slug: $slug, includeBlocks: $includeBlocks) {
      id
      title
      slug
      category
      excerpt
      author
      authorUrl
      authorRole
      publishedAtUnix
      tags
      canonicalUrl
      ogImage
      schemaType
      sourceUrl
      sourceName
      reviewedBy
      reviewedByUrl
      reviewedDateUnix
      publisherName
      publisherUrl
      publisherLogo
      robots
      blocks @include(if: $includeBlocks) {
        id
        type
        content
        attrsJson
      }
      createdAtUnix
      updatedAtUnix
    }
  }
`

const CREATE_PUBLICATION_MUTATION = /* GraphQL */ `
  mutation CreateConsolePublication($publication: PublicationInput!) {
    createConsolePublication(publication: $publication) {
      slug
    }
  }
`

const UPDATE_PUBLICATION_MUTATION = /* GraphQL */ `
  mutation UpdateConsolePublicationBySlug(
    $slug: String!
    $publication: PublicationInput!
    $expectedVersion: String
    $expectedCurrentRevision: String
  ) {
    updateConsolePublicationBySlug(
      slug: $slug
      publication: $publication
      expectedVersion: $expectedVersion
      expectedCurrentRevision: $expectedCurrentRevision
    ) {
      slug
    }
  }
`

function asString(value: unknown): string {
  return String(value || '').trim()
}

function parseUnixToDateTimeLocal(raw: string | number | null | undefined): string {
  const value = Number(String(raw || '').trim())
  if (!Number.isFinite(value) || value <= 0) return ''
  const date = new Date(value * 1000)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toUnixSeconds(raw: string | undefined): string | undefined {
  const value = asString(raw)
  if (!value) return undefined
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return undefined
  return String(Math.floor(ms / 1000))
}

function normalizeCategory(raw: string | undefined): PublicationCategory {
  const value = asString(raw).toLowerCase()
  return PUBLICATION_CATEGORY_ALIASES[value] || 'news'
}

function toGqlCategory(raw: string | undefined): string {
  return CATEGORY_TO_GQL[normalizeCategory(raw)] || 'NEWS'
}

function toGqlCategoryStrict(raw: string | undefined): string | null {
  const value = asString(raw).toLowerCase()
  const category = PUBLICATION_CATEGORY_ALIASES[value]
  if (!category) return null
  return CATEGORY_TO_GQL[category] || null
}

function fromGqlCategory(raw: string | undefined): PublicationCategory {
  const value = asString(raw).toUpperCase()
  return GQL_TO_CATEGORY[value] || 'news'
}

function normalizeStatus(raw: string | undefined): PublicationStatus {
  const value = asString(raw).toLowerCase()
  if (value === 'in_review' || value === 'scheduled' || value === 'published' || value === 'archived') return value
  return 'draft'
}

function toGqlStatus(raw: string | undefined): string {
  return STATUS_TO_GQL[normalizeStatus(raw)] || 'DRAFT'
}

function fromGqlStatus(raw: string | undefined): 'draft' | 'published' | 'archived' {
  const value = asString(raw).toUpperCase()
  if (value === 'ARCHIVED') return 'archived'
  return value === 'PUBLISHED' ? 'published' : 'draft'
}

function toGqlVisibility(raw: string | undefined): string {
  const value = asString(raw).toLowerCase()
  if (value === 'unlisted' || value === 'private') return VISIBILITY_TO_GQL[value]
  return 'PUBLIC'
}

function fromGqlVisibility(raw: string | undefined): PublicationVisibility {
  const value = asString(raw).toUpperCase()
  return GQL_TO_VISIBILITY[value] || 'public'
}

function normalizeSchemaType(raw: string | undefined): PublicationSchemaType {
  const value = asString(raw)
  if (value === 'NewsArticle' || value === 'BlogPosting') return value
  return 'Article'
}

function toGqlSchemaType(raw: string | undefined): string {
  return SCHEMA_TYPE_TO_GQL[normalizeSchemaType(raw)] || 'ARTICLE'
}

function fromGqlSchemaType(raw: string | undefined): PublicationSchemaType {
  const value = asString(raw).toUpperCase()
  return GQL_TO_SCHEMA_TYPE[value] || 'Article'
}

function normalizeBlockId(raw: unknown, index: number): string {
  const value = asString(raw).toLowerCase()
  if (/^[a-z0-9]{6}$/.test(value)) return value

  const seed = `${value}${index}${Math.random().toString(36).slice(2, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (seed.length >= 6) return seed.slice(0, 6)
  return (seed + '000000').slice(0, 6)
}

function parseAttrsJson(raw: string): Record<string, any> {
  const value = asString(raw)
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function toEditorBlocks(blocks: GraphQLPublicationBlock[] | undefined): PublicationEditorBlock[] {
  return Array.isArray(blocks)
    ? blocks.map((block, index) => ({
      id: normalizeBlockId(block.id, index),
      type: asString(block.type) || 'paragraph',
      content: asString(block.content),
      attrs: parseAttrsJson(block.attrsJson),
    }))
    : []
}

function toGraphQLBlocks(blocks: PublicationEditorBlock[]): Array<{ id: string; type: string; content: string; attrsJson: string }> {
  return (Array.isArray(blocks) ? blocks : []).map((block, index) => ({
    id: normalizeBlockId(block?.id, index),
    type: asString(block?.type) || 'paragraph',
    content: asString(block?.content),
    attrsJson: JSON.stringify(block?.attrs || {}),
  }))
}

function transliterateCyrillic(value: string): string {
  let out = ''
  for (const ch of String(value || '').toLowerCase()) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch
  }
  return out
}

function slugify(value: string): string {
  return transliterateCyrillic(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function stripHtml(raw: string): string {
  return String(raw || '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstNonEmptyBlockText(blocks: PublicationEditorBlock[]): string {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const text = stripHtml(asString(block?.content))
    if (text) return text
  }
  return ''
}

function toPublicationInput(article: PublicationEditorArticle, blocks: PublicationEditorBlock[]) {
  const title = asString(article.title)
  const slug = slugify(asString(article.slug)) || slugify(title)
  const excerpt = asString(article.metaDescription) || firstNonEmptyBlockText(blocks).slice(0, 160)

  return {
    title,
    slug,
    category: toGqlCategory(article.category),
    status: toGqlStatus(article.status),
    visibility: toGqlVisibility(article.status === 'published' ? 'public' : 'public'),
    excerpt: excerpt || undefined,
    author: asString(article.author) || undefined,
    authorUrl: asString(article.authorUrl) || undefined,
    authorRole: asString(article.authorRole) || undefined,
    publishedAtUnix: toUnixSeconds(article.publishedAt),
    featuredImage: asString(article.featuredImage) || undefined,
    tags: Array.isArray(article.tags) ? article.tags.map((tag) => asString(tag)).filter(Boolean) : [],
    focusKeyword: asString(article.focusKeyword) || undefined,
    metaTitle: asString(article.metaTitle) || title || undefined,
    metaDescription: asString(article.metaDescription) || excerpt || undefined,
    canonicalUrl: asString(article.canonicalUrl) || undefined,
    ogImage: asString(article.ogImage) || undefined,
    schemaType: toGqlSchemaType(article.schemaType),
    sourceUrl: asString(article.sourceUrl) || undefined,
    sourceName: asString(article.sourceName) || undefined,
    reviewedBy: asString(article.reviewedBy) || undefined,
    reviewedByUrl: asString(article.reviewedByUrl) || undefined,
    reviewedDateUnix: toUnixSeconds(article.reviewedDate),
    publisherName: asString(article.publisherName) || undefined,
    publisherUrl: asString(article.publisherUrl) || undefined,
    publisherLogo: asString(article.publisherLogo) || undefined,
    robots: asString(article.robots) || undefined,
    blocks: toGraphQLBlocks(blocks),
  }
}

function mapPublicationToEditorArticle(publication: GraphQLPublication): PublicationEditorArticle {
  return {
    title: asString(publication.title),
    slug: asString(publication.slug),
    status: fromGqlStatus(publication.status),
    category: fromGqlCategory(publication.category),
    author: asString(publication.author),
    authorUrl: asString(publication.authorUrl),
    authorRole: asString(publication.authorRole),
    publishedAt: parseUnixToDateTimeLocal(publication.publishedAtUnix),
    updatedAt: parseUnixToDateTimeLocal(publication.updatedAtUnix),
    featuredImage: asString(publication.featuredImage),
    tags: Array.isArray(publication.tags) ? publication.tags.map((tag) => asString(tag)).filter(Boolean) : [],
    focusKeyword: asString(publication.focusKeyword),
    metaTitle: asString(publication.metaTitle),
    metaDescription: asString(publication.metaDescription),
    canonicalUrl: asString(publication.canonicalUrl),
    ogImage: asString(publication.ogImage),
    schemaType: fromGqlSchemaType(publication.schemaType),
    sourceUrl: asString(publication.sourceUrl),
    sourceName: asString(publication.sourceName),
    reviewedBy: asString(publication.reviewedBy),
    reviewedByUrl: asString(publication.reviewedByUrl),
    reviewedDate: parseUnixToDateTimeLocal(publication.reviewedDateUnix),
    publisherName: asString(publication.publisherName) || 'Lota',
    publisherUrl: asString(publication.publisherUrl),
    publisherLogo: asString(publication.publisherLogo),
    robots: asString(publication.robots) || 'index',
    version: asString(publication.version),
    currentRevision: asString(publication.currentRevision),
  }
}

function mapPublicPublicationToArticle(publication: GraphQLPublicPublication, body: string): { slug: string; category: string; meta: Record<string, string | string[]>; body: string } {
  return {
    slug: asString(publication.slug),
    category: fromGqlCategory(publication.category),
    meta: {
      title: asString(publication.title),
      description: asString(publication.excerpt),
      author: asString(publication.author),
      author_url: asString(publication.authorUrl),
      author_role: asString(publication.authorRole),
      date: parseUnixToDateTimeLocal(publication.publishedAtUnix),
      canonical: asString(publication.canonicalUrl),
      og_image: asString(publication.ogImage),
      source_url: asString(publication.sourceUrl),
      source_name: asString(publication.sourceName),
      reviewed_by: asString(publication.reviewedBy),
      reviewed_by_url: asString(publication.reviewedByUrl),
      reviewed_date: parseUnixToDateTimeLocal(publication.reviewedDateUnix),
      publisher_name: asString(publication.publisherName) || 'Lota',
      publisher_url: asString(publication.publisherUrl),
      publisher_logo: asString(publication.publisherLogo),
      schema_type: normalizeSchemaType(publication.schemaType),
      robots: asString(publication.robots) || 'index,follow',
      tags: Array.isArray(publication.tags) ? publication.tags.map((tag) => asString(tag)).filter(Boolean) : [],
    },
    body,
  }
}

export function publicationBlocksToHtml(
  blocks: GraphQLPublicationBlock[] | undefined,
  options?: { isAuthorized?: boolean }
): string {
  const isAuthorized = !!options?.isAuthorized
  const parts: string[] = []
  const loginHref = '/?auth-needed=true'
  const authBackToOnClick = "try{var p=(window.location.pathname||'/')+(window.location.search||'')+(window.location.hash||'');localStorage.setItem('back-to',p.replace(/^\\//,''));}catch(e){}"

  const renderUnauthorizedProtected = (kind: 'block' | 'section') => {
    const kindLabel = 'Эксклюзивный контент'
    const kindTitle = kind === 'section'
      ? 'Войдите, чтобы открыть весь раздел'
      : 'Войдите, чтобы открыть продолжение'
    const kindText = kind === 'section'
      ? 'После входа будет доступен полный блок с дополнительными деталями.'
      : 'После входа откроется дополнительный материал с полезными нюансами.'
    const kindStyle = kind === 'section'
      ? 'bg-slate-100/90 dark:bg-slate-800/42'
      : 'bg-zinc-100/90 dark:bg-zinc-800/38'
    const animatedBg = kind === 'section'
      ? 'radial-gradient(120% 160% at 5% 5%, rgba(148,163,184,0.16) 0%, rgba(148,163,184,0) 48%), radial-gradient(120% 160% at 95% 95%, rgba(100,116,139,0.12) 0%, rgba(100,116,139,0) 52%), linear-gradient(140deg, rgba(248,250,252,0.92) 0%, rgba(241,245,249,0.88) 100%)'
      : 'radial-gradient(120% 160% at 5% 5%, rgba(161,161,170,0.16) 0%, rgba(161,161,170,0) 48%), radial-gradient(120% 160% at 95% 95%, rgba(113,113,122,0.12) 0%, rgba(113,113,122,0) 52%), linear-gradient(140deg, rgba(250,250,250,0.92) 0%, rgba(244,244,245,0.88) 100%)'
    return `
      <section class="relative my-6 overflow-hidden rounded-2xl p-5 shadow-[0_6px_24px_rgba(15,23,42,0.05)] ${kindStyle}" data-protected="true" data-protected-kind="${kind}">
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 opacity-78"
          style="background-image:${animatedBg};background-size:230% 230%;animation:spoilerFlow 9s ease-in-out infinite;"
        ></div>
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 mix-blend-soft-light opacity-12"
          style="background-image:radial-gradient(circle at 12% 18%, rgba(255,255,255,0.52) 0 1px, transparent 2px),radial-gradient(circle at 80% 62%, rgba(255,255,255,0.44) 0 1px, transparent 2px),radial-gradient(circle at 44% 82%, rgba(255,255,255,0.38) 0 1px, transparent 2px);background-size:20px 20px,24px 24px,28px 28px;animation:spoilerNoise 8s linear infinite;"
        ></div>
        <div
          aria-hidden="true"
          class="pointer-events-none absolute -inset-y-full left-[-38%] w-[34%]"
          style="background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.38) 50%, rgba(255,255,255,0) 100%);transform:skewX(-18deg);animation:exclusiveSheen 4.4s ease-in-out infinite;"
        ></div>
        <div class="relative">
        <div class="inline-flex items-center rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">${kindLabel}</div>
        <h3 class="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">${kindTitle}</h3>
        <p class="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">${kindText}</p>
        <a
          href="${loginHref}"
          onclick="${authBackToOnClick}"
          class="mt-4 inline-flex items-center rounded-full border border-transparent px-5 py-2 text-sm font-semibold leading-none transition hover:brightness-[1.03]"
          style="background:linear-gradient(rgba(255,255,255,0.94),rgba(255,255,255,0.94)) padding-box,linear-gradient(90deg,#3b82f6 0%,#10b981 100%) border-box;"
        >
          <span class="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">Посмотреть</span>
        </a>
        </div>
      </section>
    `
  }

  const renderAuthorizedExclusive = (innerHtml: string, kind: 'block' | 'section') => {
    const kindBadge = 'эксклюзив'
    const kindBackground = kind === 'section'
      ? 'linear-gradient(145deg, rgba(241,245,249,0.58) 0%, rgba(226,232,240,0.44) 52%, rgba(241,245,249,0.5) 100%)'
      : 'linear-gradient(145deg, rgba(244,244,245,0.56) 0%, rgba(228,228,231,0.42) 52%, rgba(244,244,245,0.5) 100%)'
    const kindAccent = kind === 'section'
      ? 'radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0) 56%), radial-gradient(120% 140% at 100% 100%, rgba(148,163,184,0.16) 0%, rgba(148,163,184,0) 62%)'
      : 'radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.54) 0%, rgba(255,255,255,0) 56%), radial-gradient(120% 140% at 100% 100%, rgba(113,113,122,0.15) 0%, rgba(113,113,122,0) 62%)'
    const kindGlint = kind === 'section'
      ? 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.36) 46%, rgba(255,255,255,0) 100%)'
      : 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.34) 46%, rgba(255,255,255,0) 100%)'
    const innerPadding = kind === 'section'
      ? 'px-4 pb-4 pt-2.5'
      : 'px-4 py-3'
    return `
      <section class="relative my-6 overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_28px_rgba(15,23,42,0.06)]" style="background:${kindBackground};backdrop-filter:blur(10px) saturate(130%);-webkit-backdrop-filter:blur(10px) saturate(130%);" data-protected="true" data-protected-kind="${kind}">
        <div aria-hidden="true" class="pointer-events-none absolute inset-0" style="background-image:${kindAccent};"></div>
        <div aria-hidden="true" class="pointer-events-none absolute -inset-y-full left-[-42%] w-[34%]" style="background:${kindGlint};transform:skewX(-17deg);animation:exclusiveSheen 6s ease-in-out infinite;"></div>
        <div class="relative px-4 pt-2 text-[10px] font-medium tracking-[0.02em] text-slate-500 dark:text-slate-500">${kindBadge}</div>
        <div class="relative ${innerPadding}">${innerHtml}</div>
      </section>
    `
  }

  // Always inject keyframes into article HTML so animation works reliably across SSR requests.
  parts.push(`
    <style>
      @keyframes spoilerFlow {
        0% { background-position: 0% 0%; }
        50% { background-position: 100% 100%; }
        100% { background-position: 0% 0%; }
      }
      @keyframes spoilerNoise {
        0% { transform: translate3d(0,0,0) scale(1); }
        25% { transform: translate3d(0.8%, -0.6%, 0) scale(1.02); }
        50% { transform: translate3d(-0.6%, 0.8%, 0) scale(1.03); }
        75% { transform: translate3d(0.7%, 0.4%, 0) scale(1.01); }
        100% { transform: translate3d(0,0,0) scale(1); }
      }
      @keyframes exclusiveSheen {
        0% { transform: translateX(-160%) skewX(-18deg); opacity: 0; }
        20% { opacity: 0.45; }
        55% { opacity: 0.5; }
        100% { transform: translateX(470%) skewX(-18deg); opacity: 0; }
      }
    </style>
  `)

  let openSpoilerInner: string[] = []
  let isSpoilerOpen = false

  const flushOpenSpoiler = () => {
    if (!isSpoilerOpen) return

    if (!isAuthorized) {
      parts.push(renderUnauthorizedProtected('section'))
    } else {
      parts.push(renderAuthorizedExclusive(openSpoilerInner.join(''), 'section'))
    }

    openSpoilerInner = []
    isSpoilerOpen = false
  }

  const pushContent = (html: string) => {
    if (!html) return
    if (isSpoilerOpen && isAuthorized) {
      openSpoilerInner.push(html)
      return
    }
    if (isSpoilerOpen && !isAuthorized) {
      return
    }
    parts.push(html)
  }

  for (const block of Array.isArray(blocks) ? blocks : []) {
    const type = asString(block.type) || 'paragraph'
    const attrs = parseAttrsJson(block.attrsJson)
    const content = asString(block.content)

    if (type === 'spoiler_open') {
      flushOpenSpoiler()
      isSpoilerOpen = true
      continue
    }

    if (type === 'spoiler_close') {
      flushOpenSpoiler()
      continue
    }

    if (type === 'divider') {
      pushContent('<hr class="my-8 border-slate-200 dark:border-slate-700" />')
      continue
    }

    if (type === 'image') {
      const src = asString(attrs.src)
      if (!src) continue
      const alt = asString(attrs.alt)
      const caption = asString(attrs.caption)
      pushContent(`
        <figure class="my-6">
          <img src="${src.replace(/"/g, '&quot;')}" alt="${alt.replace(/"/g, '&quot;')}" class="w-full rounded-2xl border border-gray-200 object-cover dark:border-gray-700" loading="lazy" decoding="async" />
          ${caption ? `<figcaption class="mt-2 text-sm text-slate-500 dark:text-slate-400">${caption}</figcaption>` : ''}
        </figure>
      `)
      continue
    }

    if (type === 'ul' || type === 'ol') {
      const listTag = type
      const items = content.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || []
      if (!items.length) continue
      pushContent(`<${listTag} class="my-4 list-${listTag === 'ul' ? 'disc' : 'decimal'} space-y-1 pl-6 text-base leading-7 text-gray-700 dark:text-gray-300">${items.join('')}</${listTag}>`)
      continue
    }

    if (type === 'quote') {
      pushContent(`<blockquote class="my-6 border-l-4 border-blue-300 pl-5 italic text-gray-600 dark:border-blue-600 dark:text-gray-400">${content}</blockquote>`)
      continue
    }

    if (type === 'callout') {
      const calloutType = asString(attrs.calloutType) || 'info'
      const calloutClasses = {
        info: 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900',
        warning: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900',
        success: 'bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900',
      }[calloutType] || 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900'
      pushContent(`<div class="my-6 rounded-xl p-4 ${calloutClasses}">${content}</div>`)
      continue
    }

    if (type === 'spoiler') {
      if (!isAuthorized) {
        pushContent(renderUnauthorizedProtected('block'))
        continue
      }

      pushContent(renderAuthorizedExclusive(`<div class="text-sm leading-7 text-slate-700 dark:text-slate-300">${content}</div>`, 'block'))
      continue
    }

    if (type === 'html') {
      pushContent(`<div class="my-4">${content}</div>`)
      continue
    }

    if (type === 'h2' || type === 'h3' || type === 'h4' || type === 'h5') {
      const tag = type
      const classes = {
        h2: 'mt-10 mb-3 text-3xl font-bold text-gray-900 dark:text-gray-100',
        h3: 'mt-8 mb-3 text-2xl font-bold text-gray-900 dark:text-gray-100',
        h4: 'mt-7 mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100',
        h5: 'mt-6 mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100',
      }[tag]
      pushContent(`<${tag} class="${classes}">${content}</${tag}>`)
      continue
    }

    pushContent(`<p class="my-4 text-base leading-7 text-gray-700 dark:text-gray-300">${content}</p>`)
  }

  flushOpenSpoiler()
  return parts.join('')
}

export async function capitalListPublications(token: string, filter: Record<string, any> = {}): Promise<PublicationListPayload> {
  setGlobalAuthToken(token || null)
  const gqlFilter = {
    ...filter,
    category: filter?.category ? toGqlCategory(filter.category) : undefined,
    status: filter?.status ? toGqlStatus(filter.status) : undefined,
    visibility: filter?.visibility ? toGqlVisibility(filter.visibility) : undefined,
  }
  const res = await capitalClient.request<{ consolePublications: PublicationListPayload }>(CONSOLE_PUBLICATIONS_QUERY, { filter: gqlFilter })
  return res.consolePublications
}

export async function capitalGetPublicationBySlug(token: string, slug: string): Promise<{ article: PublicationEditorArticle; blocks: PublicationEditorBlock[] } | null> {
  setGlobalAuthToken(token || null)
  const res = await capitalClient.request<{ consolePublicationBySlug: GraphQLPublication | null }>(CONSOLE_PUBLICATION_BY_SLUG_QUERY, { slug, includeBlocks: true })
  if (!res.consolePublicationBySlug) return null
  return {
    article: mapPublicationToEditorArticle(res.consolePublicationBySlug),
    blocks: toEditorBlocks(res.consolePublicationBySlug.blocks),
  }
}

export async function capitalGetPublicPublicationByRoute(token: string, category: string, slug: string): Promise<{ slug: string; category: string; meta: Record<string, string | string[]>; body: string } | null> {
  const gqlCategory = toGqlCategoryStrict(category)
  if (!gqlCategory) return null

  const normalizedCategory = normalizeCategory(category)
  const categoryCandidates: string[] = [gqlCategory]
  if (normalizedCategory === 'articles') categoryCandidates.push(CATEGORY_TO_GQL.blog)
  if (normalizedCategory === 'blog') categoryCandidates.push(CATEGORY_TO_GQL.articles)
  // Defensive fallback: article slug can be moved across categories in CMS,
  // but old links may still point to a previous category path.
  for (const value of Object.values(CATEGORY_TO_GQL)) {
    if (!categoryCandidates.includes(value)) {
      categoryCandidates.push(value)
    }
  }

  const fetchByCategories = async (): Promise<{ publicPublicationByRoute: GraphQLPublicPublication | null }> => {
    for (const candidate of categoryCandidates) {
      try {
        const result = await capitalClient.request<{ publicPublicationByRoute: GraphQLPublicPublication | null }>(PUBLIC_PUBLICATION_BY_ROUTE_QUERY, {
          category: candidate,
          slug,
          includeBlocks: true,
        })
        if (result.publicPublicationByRoute) return result
      } catch (error: any) {
        const status = error?.response?.status ?? error?.response?.statusCode ?? error?.status
        const messages = Array.isArray(error?.response?.errors)
          ? error.response.errors.map((e: any) => String(e?.message || '').toLowerCase())
          : []
        const isNotFound = status === 404 || messages.some((m: string) => m.includes('not found') || m.includes('code = notfound'))
        if (isNotFound) {
          continue
        }
        throw error
      }
    }
    return { publicPublicationByRoute: null }
  }

  let isAuthorized = false
  const normalizedToken = asString(token)
  let res: { publicPublicationByRoute: GraphQLPublicPublication | null }

  try {
    setGlobalAuthToken(normalizedToken || null)
    isAuthorized = !!normalizedToken
    res = await fetchByCategories()
  } catch (error: any) {
    const status = error?.response?.status ?? error?.response?.statusCode ?? error?.status
    const messages = Array.isArray(error?.response?.errors)
      ? error.response.errors.map((e: any) => String(e?.message || '').toLowerCase())
      : []
    const isUnauthorized = status === 401 || messages.some((m: string) => m.includes('unauthorized') && m.includes('token'))

    if (!isUnauthorized) throw error

    // Fall back to unauthenticated public fetch when token is stale or invalid.
    setGlobalAuthToken(null)
    isAuthorized = false
    res = await fetchByCategories()
  }

  if (!res.publicPublicationByRoute) {
    // Fallback for admin-authenticated sessions: if publication is not reachable
    // via public route query (category/status mismatch), try direct console slug lookup.
    if (normalizedToken) {
      try {
        setGlobalAuthToken(normalizedToken)
        const consoleRes = await capitalClient.request<{ consolePublicationBySlug: GraphQLPublication | null }>(CONSOLE_PUBLICATION_BY_SLUG_QUERY, {
          slug,
          includeBlocks: true,
        })
        const consolePub = consoleRes.consolePublicationBySlug
        if (consolePub) {
          return mapPublicPublicationToArticle(
            consolePub as unknown as GraphQLPublicPublication,
            publicationBlocksToHtml(consolePub.blocks, { isAuthorized: true })
          )
        }
      } catch {
        // Ignore and return null below.
      }
    }
    return null
  }
  return mapPublicPublicationToArticle(
    res.publicPublicationByRoute,
    publicationBlocksToHtml(res.publicPublicationByRoute.blocks, { isAuthorized })
  )
}

export async function capitalCreatePublication(token: string, article: PublicationEditorArticle, blocks: PublicationEditorBlock[]): Promise<string> {
  setGlobalAuthToken(token || null)
  const res = await capitalClient.request<{ createConsolePublication: { slug: string } }>(CREATE_PUBLICATION_MUTATION, {
    publication: toPublicationInput(article, blocks),
  })
  return asString(res.createConsolePublication?.slug)
}

export async function capitalUpdatePublication(token: string, slug: string, article: PublicationEditorArticle, blocks: PublicationEditorBlock[]): Promise<string> {
  setGlobalAuthToken(token || null)
  const res = await capitalClient.request<{ updateConsolePublicationBySlug: { slug: string } }>(UPDATE_PUBLICATION_MUTATION, {
    slug,
    expectedVersion: article.version || undefined,
    expectedCurrentRevision: article.currentRevision || undefined,
    publication: toPublicationInput(article, blocks),
  })
  return asString(res.updateConsolePublicationBySlug?.slug)
}

export async function capitalDeletePublication(token: string, slug: string, expectedVersion?: string): Promise<boolean> {
  return capitalArchivePublication(token, slug, expectedVersion)
}

export async function capitalArchivePublication(token: string, slug: string, expectedVersion?: string): Promise<boolean> {
  const current = await capitalGetPublicationBySlug(token, slug)
  if (!current) return false

  await capitalUpdatePublication(token, slug, {
    ...current.article,
    status: 'archived',
    version: asString(expectedVersion) || current.article.version || undefined,
  }, current.blocks)

  return true
}

export function toPublicationListDate(value: string): string {
  const parsed = parseUnixToDateTimeLocal(value)
  if (!parsed) return ''
  return parsed.replace('T', ' ')
}

export function normalizePublicationCategory(value: string): PublicationCategory {
  return normalizeCategory(value)
}
