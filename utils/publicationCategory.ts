// Single source of truth for the client-facing publication category <-> GraphQL
// enum mapping. Used by both server routes (Nitro) and client/universal code
// (pages, api/publications.ts) -- previously duplicated across four files,
// which is exactly the kind of drift that caused the learning->academy rename
// to miss a spot.

export type PublicationCategory = 'blog' | 'whatsnew' | 'articles' | 'academy' | 'news'

export const PUBLICATION_CATEGORY_ALIASES: Record<string, PublicationCategory> = {
  blog: 'blog',
  whatsnew: 'whatsnew',
  articles: 'articles',
  academy: 'academy',
  news: 'news',
}

export const CATEGORY_TO_GQL: Record<PublicationCategory, string> = {
  blog: 'BLOG',
  whatsnew: 'WHATSNEW',
  articles: 'ARTICLES',
  academy: 'LEARNING',
  news: 'NEWS',
}

export const GQL_TO_CATEGORY: Record<string, PublicationCategory> = {
  BLOG: 'blog',
  WHATSNEW: 'whatsnew',
  ARTICLES: 'articles',
  LEARNING: 'academy',
  NEWS: 'news',
}

export function toGqlCategory(raw: string | undefined): string {
  const value = String(raw || '').trim().toLowerCase()
  return CATEGORY_TO_GQL[PUBLICATION_CATEGORY_ALIASES[value]] || value.toUpperCase() || 'NEWS'
}

export function fromGqlCategory(raw: string | undefined): PublicationCategory {
  const value = String(raw || '').trim().toUpperCase()
  return GQL_TO_CATEGORY[value] || 'news'
}
