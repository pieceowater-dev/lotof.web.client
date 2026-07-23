import { capitalClient, setGlobalAuthToken } from '@/api/clients'
import { getApiBaseUrl } from '@/utils/api-base'
import {
  type PublicationCategory,
  PUBLICATION_CATEGORY_ALIASES,
  CATEGORY_TO_GQL,
  GQL_TO_CATEGORY,
  toGqlCategory,
  fromGqlCategory,
} from '@/utils/publicationCategory'

export type { PublicationCategory }
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
  featuredImageAlt: string
  tags: string[]
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
  status: PublicationStatus
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
  featuredImageAlt: string
  tags: string[]
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
  featuredImageAlt: string
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
// Note: the "learning" GraphQL field name is fixed by the backend schema; the client
// remaps it to "academy" when exposing counts (see capitalListPublications below).

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
      featuredImageAlt
      tags
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
      featuredImageAlt
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

const UPLOAD_PUBLICATION_IMAGE_MUTATION = /* GraphQL */ `
  mutation UploadConsolePublicationImage(
    $slug: String!
    $file: Upload!
    $kind: PublicationUploadKind = FEATURED
    $alt: String
    $caption: String
  ) {
    uploadConsolePublicationImage(
      slug: $slug
      file: $file
      kind: $kind
      alt: $alt
      caption: $caption
    ) {
      assetId
      url
      key
      contentType
      size
      kind
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

function toGqlCategoryStrict(raw: string | undefined): string | null {
  const value = asString(raw).toLowerCase()
  const category = PUBLICATION_CATEGORY_ALIASES[value]
  if (!category) return null
  return CATEGORY_TO_GQL[category] || null
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

function normalizeEditorBlockAttrs(type: string, attrs: Record<string, any>): Record<string, any> {
  const nextAttrs = { ...(attrs || {}) }
  const normalizedType = String(type || '')
  const normalizeButtonVariant = (value: string) => {
    const raw = asString(value).toLowerCase()
    if (raw === 'outline' || raw === 'soft' || raw === 'link') return raw
    if (raw === 'secondary') return 'outline'
    return 'solid'
  }
  if (normalizedType === 'image') {
    const legacySrc = asString(nextAttrs.s)
    if (legacySrc && !asString(nextAttrs.src)) {
      nextAttrs.src = legacySrc
    }

    const legacyAssetId = asString(nextAttrs.ai)
    if (legacyAssetId && !asString(nextAttrs.assetId)) {
      nextAttrs.assetId = legacyAssetId
    }

    const legacyAlt = asString(nextAttrs.a || nextAttrs.imageAlt)
    if (legacyAlt && !asString(nextAttrs.alt)) {
      nextAttrs.alt = legacyAlt
    }
  }

  if (normalizedType === 'button') {
    const text = asString(nextAttrs.tx)
    if (text && !asString(nextAttrs.text)) {
      nextAttrs.text = text
    }

    const href = asString(nextAttrs.hr)
    if (href && !asString(nextAttrs.href)) {
      nextAttrs.href = href
    }

    if (typeof nextAttrs.nt === 'boolean' && typeof nextAttrs.newTab !== 'boolean') {
      nextAttrs.newTab = nextAttrs.nt
    }

    const kind = asString(nextAttrs.kd)
    if (kind && !asString(nextAttrs.kind)) {
      nextAttrs.kind = kind
    }

    const variant = asString(nextAttrs.vr)
    if (variant && !asString(nextAttrs.variant)) {
      nextAttrs.variant = normalizeButtonVariant(variant)
    }

    if (asString(nextAttrs.variant)) {
      nextAttrs.variant = normalizeButtonVariant(nextAttrs.variant)
    } else {
      nextAttrs.variant = 'solid'
    }

    // Remove short backend keys so saves always use updated long-key values
    delete nextAttrs.tx
    delete nextAttrs.hr
    delete nextAttrs.nt
    delete nextAttrs.kd
    delete nextAttrs.vr
  }

  if (normalizedType === 'faq') {
    const items = Array.isArray(nextAttrs.it) ? nextAttrs.it : []
    if (items.length && !Array.isArray(nextAttrs.items)) {
      nextAttrs.items = items
    }
    // Remove short backend key so saves always use updated long-key value
    delete nextAttrs.it
  }

  return nextAttrs
}

function toEditorBlocks(blocks: GraphQLPublicationBlock[] | undefined): PublicationEditorBlock[] {
  return Array.isArray(blocks)
    ? blocks.map((block, index) => ({
      id: normalizeBlockId(block.id, index),
      type: asString(block.type) || 'paragraph',
      content: asString(block.content),
      attrs: normalizeEditorBlockAttrs(asString(block.type) || 'paragraph', parseAttrsJson(block.attrsJson)),
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
  const featuredImage = asString(article.featuredImage)

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
    featuredImage: featuredImage || undefined,
    featuredImageAlt: asString(article.featuredImageAlt) || undefined,
    tags: Array.isArray(article.tags) ? article.tags.map((tag) => asString(tag)).filter(Boolean) : [],
    metaTitle: asString(article.metaTitle) || title || undefined,
    metaDescription: asString(article.metaDescription) || excerpt || undefined,
    canonicalUrl: asString(article.canonicalUrl) || undefined,
    // Public route exposes ogImage; keep it synced with main editor image.
    ogImage: featuredImage || asString(article.ogImage) || undefined,
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
    featuredImageAlt: asString(publication.featuredImageAlt),
    tags: Array.isArray(publication.tags) ? publication.tags.map((tag) => asString(tag)).filter(Boolean) : [],
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
      featured_image_alt: asString(publication.featuredImageAlt),
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

  const buttonVariantClass = (variant: string) => {
    const value = asString(variant).toLowerCase() || 'classic'
    if (value === 'outline') {
      return 'group inline-flex items-center gap-2 rounded-md border border-blue-500 bg-transparent px-5 py-3 text-sm font-semibold text-blue-600 shadow-sm transition duration-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/30 dark:hover:text-blue-200'
    }
    if (value === 'soft') {
      return 'group inline-flex items-center gap-2 rounded-md bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition duration-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60'
    }
    if (value === 'link') {
      return 'group inline-flex items-center gap-2 px-1 py-1 text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200'
    }
    return 'group inline-flex items-center gap-2 rounded-md bg-blue-500 px-5 py-3 text-sm font-semibold !text-white no-underline shadow-sm transition duration-200 hover:bg-blue-600 dark:bg-blue-500 dark:!text-white dark:hover:bg-blue-400'
  }

  const headingAnchorCounts = new Map<string, number>()
  const nextHeadingAnchor = (value: string, fallbackIndex: number) => {
    const base = slugify(stripHtml(value)).slice(0, 80) || `section-${fallbackIndex + 1}`
    const count = headingAnchorCounts.get(base) || 0
    headingAnchorCounts.set(base, count + 1)
    return count === 0 ? base : `${base}-${count + 1}`
  }

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

  const esc = (value: string) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

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

  for (const [index, block] of (Array.isArray(blocks) ? blocks : []).entries()) {
    const type = asString(block.type) || 'paragraph'
    const attrs = normalizeEditorBlockAttrs(type, parseAttrsJson(block.attrsJson))
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
      const src = asString(attrs.src || attrs.s)
      if (!src) continue
      const alt = asString(attrs.alt || attrs.a || attrs.imageAlt)
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

    if (type === 'button') {
      const kind = asString(attrs.kind).toLowerCase() || 'custom'
      const variant = asString(attrs.variant) || 'solid'
      const text = asString(attrs.text) || (kind === 'login' ? 'Войти' : 'Подробнее')
      const href = kind === 'login' ? '/?auth-needed=true' : asString(attrs.href)
      if (!href) continue

      const isAnchor = href.startsWith('#')
      const shouldOpenInNewTab = Boolean(attrs.newTab) && !isAnchor && kind !== 'login'
      const target = shouldOpenInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ''
      const clickHandler = kind === 'login' ? ` onclick="${authBackToOnClick}"` : ''

      pushContent(
        `<div class="my-8">` +
        `<a href="${esc(href)}"${target}${clickHandler} class="${buttonVariantClass(variant)}"><span>${esc(text)}</span><span aria-hidden="true" class="text-base leading-none transition duration-200 group-hover:translate-x-0.5">→</span></a>` +
        `</div>`
      )
      continue
    }

    if (type === 'faq') {
      const items = Array.isArray(attrs.items) ? attrs.items : []
      const validItems = items.filter((item) => {
        const q = asString(item?.q)
        const a = asString(item?.a)
        return !!q && !!a
      })
      if (!validItems.length) continue

      const faqItemsHtml = validItems.map((item) => {
        const q = esc(asString(item.q))
        const a = esc(asString(item.a)).replace(/\n/g, '<br>')
        return (
          `<details class="group rounded-2xl border border-slate-200/90 bg-white/95 px-5 py-4 shadow-[0_8px_28px_rgba(15,23,42,0.05)] transition hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-blue-800/70" data-faq-item>` +
          `<summary class="flex cursor-pointer list-none items-start justify-between gap-4 pr-0 text-base font-semibold leading-6 text-slate-900 marker:content-none dark:text-slate-50" data-faq-question><span>${q}</span><span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition group-open:rotate-45 group-open:border-blue-200 group-open:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:group-open:border-blue-800 dark:group-open:text-blue-300">+</span></summary>` +
          `<div class="mt-3 border-t border-slate-100 pt-3 text-[15px] leading-7 text-slate-600 dark:border-slate-800 dark:text-slate-300" data-faq-answer>${a}</div>` +
          `</details>`
        )
      }).join('')

      pushContent(`<section class="my-10 space-y-4" data-faq-block>${faqItemsHtml}</section>`)
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
      const anchorId = nextHeadingAnchor(content, index)
      const classes = {
        h2: 'mt-10 mb-3 text-3xl font-bold text-gray-900 dark:text-gray-100',
        h3: 'mt-8 mb-3 text-2xl font-bold text-gray-900 dark:text-gray-100',
        h4: 'mt-7 mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100',
        h5: 'mt-6 mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100',
      }[tag]
      pushContent(`<${tag} id="${esc(anchorId)}" class="scroll-mt-28 ${classes}">${content}</${tag}>`)
      continue
    }

    pushContent(`<p class="my-4 text-base leading-7 text-gray-700 dark:text-gray-300">${content}</p>`)
  }

  flushOpenSpoiler()
  return parts.join('')
}

type GraphQLPublicationListItem = {
  id: string
  title: string
  slug: string
  category: string
  status: string
  visibility: string
  excerpt: string
  author: string
  publishedAtUnix: string
  scheduledAtUnix: string
  updatedAtUnix: string
  version: string
}

type GraphQLPublicationListPayload = {
  items: GraphQLPublicationListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  counts: Record<string, number>
}

function mapPublicationListItem(item: GraphQLPublicationListItem): PublicationListRow {
  return {
    id: asString(item.id),
    title: asString(item.title),
    slug: asString(item.slug),
    category: fromGqlCategory(item.category),
    status: GQL_TO_STATUS[asString(item.status).toUpperCase()] || 'draft',
    visibility: fromGqlVisibility(item.visibility),
    excerpt: asString(item.excerpt),
    author: asString(item.author),
    publishedAt: parseUnixToDateTimeLocal(item.publishedAtUnix),
    updatedAt: parseUnixToDateTimeLocal(item.updatedAtUnix),
    scheduledAt: parseUnixToDateTimeLocal(item.scheduledAtUnix),
    version: asString(item.version),
  }
}

export async function capitalListPublications(token: string, filter: Record<string, any> = {}): Promise<PublicationListPayload> {
  setGlobalAuthToken(token || null)
  const gqlFilter = {
    ...filter,
    category: filter?.category ? toGqlCategory(filter.category) : undefined,
    status: filter?.status ? toGqlStatus(filter.status) : undefined,
    visibility: filter?.visibility ? toGqlVisibility(filter.visibility) : undefined,
  }
  const res = await capitalClient.request<{ consolePublications: GraphQLPublicationListPayload }>(CONSOLE_PUBLICATIONS_QUERY, { filter: gqlFilter })
  const payload = res.consolePublications
  const rawCounts = (payload.counts || {}) as Record<string, number>
  return {
    ...payload,
    items: Array.isArray(payload.items) ? payload.items.map(mapPublicationListItem) : [],
    counts: { ...rawCounts, academy: rawCounts.learning || 0 },
  }
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
        }, { suppressErrors: true })
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

// Un-archives back to draft rather than guessing the prior status (published
// vs scheduled) -- the admin can explicitly re-publish from there.
export async function capitalRestorePublication(token: string, slug: string, expectedVersion?: string): Promise<boolean> {
  const current = await capitalGetPublicationBySlug(token, slug)
  if (!current) return false

  await capitalUpdatePublication(token, slug, {
    ...current.article,
    status: 'draft',
    version: asString(expectedVersion) || current.article.version || undefined,
  }, current.blocks)

  return true
}

export async function capitalUploadPublicationImage(
  token: string,
  slug: string,
  file: File,
  options?: { kind?: 'FEATURED' | 'INLINE'; alt?: string; caption?: string }
): Promise<{ url: string; assetId: string; key: string; contentType: string; size: string; kind: string }> {
  const operations = {
    query: UPLOAD_PUBLICATION_IMAGE_MUTATION,
    variables: {
      slug: asString(slug),
      file: null,
      kind: options?.kind || 'FEATURED',
      alt: asString(options?.alt),
      caption: asString(options?.caption),
    },
  }

  const buildForm = () => {
    const form = new FormData()
    form.append('operations', JSON.stringify(operations))
    form.append('map', JSON.stringify({ '0': ['variables.file'] }))
    form.append('0', file, file.name)
    return form
  }

  const headers: Record<string, string> = {}
  if (asString(token)) {
    headers.CapitalAuthorization = `Bearer ${asString(token)}`
  }

  const uploadUrl = `${getApiBaseUrl('capital')}/query`

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: buildForm(),
    credentials: 'omit',
  })

  const result: any = await response.json().catch(() => ({}))
  const lastMessage = String(result?.errors?.[0]?.message || result?.message || `Upload failed with status ${response.status}`)
  if (!response.ok) {
    throw new Error(lastMessage)
  }

  if (!result || result?.errors?.length) {
    throw new Error(lastMessage || 'Upload failed')
  }

  const payload = result?.data?.uploadConsolePublicationImage
  if (!payload?.url) {
    throw new Error('Upload did not return image URL')
  }

  return {
    url: asString(payload.url),
    assetId: asString(payload.assetId),
    key: asString(payload.key),
    contentType: asString(payload.contentType),
    size: asString(payload.size),
    kind: asString(payload.kind),
  }
}

export function toPublicationListDate(value: string): string {
  const parsed = parseUnixToDateTimeLocal(value)
  if (!parsed) return ''
  return parsed.replace('T', ' ')
}

export function normalizePublicationCategory(value: string): PublicationCategory {
  return normalizeCategory(value)
}
