import { fetchPublicationDocumentsFromUpstream, listPublicationDocuments } from '../../utils/publications';
import { getApiBaseUrl } from '../../../utils/api-base';

type PublicPublicationListResponse = {
  data?: {
    publicPublications?: {
      items?: Array<{
        id?: string;
        slug?: string;
        category?: string;
        title?: string;
        status?: string;
        visibility?: string;
        excerpt?: string;
        author?: string;
        publishedAtUnix?: string;
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

type ConsolePublicationListResponse = {
  data?: {
    consolePublications?: {
      items?: Array<{
        slug?: string;
        category?: string;
        title?: string;
        excerpt?: string;
        author?: string;
        publishedAtUnix?: string;
      }>;
    };
  };
  errors?: Array<{ message?: string }>;
};

type PublicPublicationByRouteResponse = {
  data?: {
    publicPublicationByRoute?: {
      slug?: string;
      category?: string;
      title?: string;
      excerpt?: string;
      author?: string;
      authorRole?: string;
      publishedAtUnix?: string;
      tags?: string[];
      ogImage?: string;
      schemaType?: string;
      sourceUrl?: string;
      sourceName?: string;
      reviewedBy?: string;
      reviewedByUrl?: string;
      reviewedDateUnix?: string;
      publisherName?: string;
      publisherUrl?: string;
      publisherLogo?: string;
      canonicalUrl?: string;
      robots?: string;
      blocks?: Array<{
        id?: string;
        type?: string;
        content?: string;
        attrsJson?: string;
      }>;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseAttrsJson(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeBlockAttrs(type: string, attrs: Record<string, any>): Record<string, any> {
  const nextAttrs = { ...(attrs || {}) };
  const normalizeButtonVariant = (value: unknown): string => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'outline' || raw === 'soft' || raw === 'link') return raw;
    if (raw === 'secondary') return 'outline';
    return 'solid';
  };

  if (type === 'image') {
    const src = String(nextAttrs.s || '').trim();
    if (src && !String(nextAttrs.src || '').trim()) {
      nextAttrs.src = src;
    }

    const assetId = String(nextAttrs.ai || '').trim();
    if (assetId && !String(nextAttrs.assetId || '').trim()) {
      nextAttrs.assetId = assetId;
    }

    const alt = String(nextAttrs.al || nextAttrs.a || nextAttrs.imageAlt || '').trim();
    if (alt && !String(nextAttrs.alt || '').trim()) {
      nextAttrs.alt = alt;
    }
  }

  if (type === 'button') {
    const text = String(nextAttrs.tx || '').trim();
    if (text && !String(nextAttrs.text || '').trim()) {
      nextAttrs.text = text;
    }

    const href = String(nextAttrs.hr || '').trim();
    if (href && !String(nextAttrs.href || '').trim()) {
      nextAttrs.href = href;
    }

    if (typeof nextAttrs.nt === 'boolean' && typeof nextAttrs.newTab !== 'boolean') {
      nextAttrs.newTab = nextAttrs.nt;
    }

    const kind = String(nextAttrs.kd || '').trim();
    if (kind && !String(nextAttrs.kind || '').trim()) {
      nextAttrs.kind = kind;
    }

    const variant = String(nextAttrs.vr || '').trim();
    if (variant && !String(nextAttrs.variant || '').trim()) {
      nextAttrs.variant = normalizeButtonVariant(variant);
    }

    if (String(nextAttrs.variant || '').trim()) {
      nextAttrs.variant = normalizeButtonVariant(nextAttrs.variant);
    } else {
      nextAttrs.variant = 'solid';
    }
  }

  if (type === 'faq') {
    const shortItems = Array.isArray(nextAttrs.it) ? nextAttrs.it : [];
    if (shortItems.length && !Array.isArray(nextAttrs.items)) {
      nextAttrs.items = shortItems;
    }
  }

  return nextAttrs;
}

function safeImageSrc(src: string): string {
  const value = String(src || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) return value;
  return '';
}

function safeLinkHref(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const lower = value.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) return '';
  return value;
}

function slugifyAnchor(value: string, fallbackIndex: number): string {
  const translit = String(value || '')
    .toLowerCase()
    .replace(/а/g, 'a').replace(/б/g, 'b').replace(/в/g, 'v').replace(/г/g, 'g').replace(/д/g, 'd')
    .replace(/е/g, 'e').replace(/ё/g, 'e').replace(/ж/g, 'zh').replace(/з/g, 'z').replace(/и/g, 'i')
    .replace(/й/g, 'y').replace(/к/g, 'k').replace(/л/g, 'l').replace(/м/g, 'm').replace(/н/g, 'n')
    .replace(/о/g, 'o').replace(/п/g, 'p').replace(/р/g, 'r').replace(/с/g, 's').replace(/т/g, 't')
    .replace(/у/g, 'u').replace(/ф/g, 'f').replace(/х/g, 'h').replace(/ц/g, 'ts').replace(/ч/g, 'ch')
    .replace(/ш/g, 'sh').replace(/щ/g, 'sch').replace(/ъ/g, '').replace(/ы/g, 'y').replace(/ь/g, '')
    .replace(/э/g, 'e').replace(/ю/g, 'yu').replace(/я/g, 'ya');

  const normalized = translit
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || `section-${fallbackIndex + 1}`;
}

function toIsoDate(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    const millis = raw.length <= 10 ? asNumber * 1000 : asNumber;
    const fromUnix = new Date(millis);
    if (!Number.isNaN(fromUnix.getTime())) return fromUnix.toISOString();
  }

  const fromNative = new Date(raw);
  if (!Number.isNaN(fromNative.getTime())) return fromNative.toISOString();

  return '';
}

function blocksToHtml(
  blocks: Array<{ type?: string; content?: string; attrsJson?: string }> | undefined,
  fallbackText: string,
  options?: { isAuthorized?: boolean }
): string {
  if (!Array.isArray(blocks) || !blocks.length) return fallbackText;

  const isAuthorized = !!options?.isAuthorized;
  const parts: string[] = [];
  const authBackToOnClick = "try{var p=(window.location.pathname||'/')+(window.location.search||'')+(window.location.hash||'');localStorage.setItem('back-to',p.replace(/^\\//,''));}catch(e){}";
  const headingAnchorCounts = new Map<string, number>();

  const buttonVariantClass = (variant: string) => {
    const value = String(variant || '').trim().toLowerCase() || 'solid';
    if (value === 'outline') {
      return 'group inline-flex items-center gap-2 rounded-md border border-blue-500 bg-transparent px-5 py-3 text-sm font-semibold text-blue-600 shadow-sm transition duration-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/30 dark:hover:text-blue-200';
    }
    if (value === 'soft') {
      return 'group inline-flex items-center gap-2 rounded-md bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition duration-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60';
    }
    if (value === 'link') {
      return 'group inline-flex items-center gap-2 px-1 py-1 text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200';
    }
    return 'group inline-flex items-center gap-2 rounded-md bg-blue-500 px-5 py-3 text-sm font-semibold !text-white no-underline shadow-sm transition duration-200 hover:bg-blue-600 dark:bg-blue-500 dark:!text-white dark:hover:bg-blue-400';
  };
  let openSpoilerInner: string[] = [];
  let isSpoilerOpen = false;

  const renderUnauthorizedProtected = (kind: 'block' | 'section') => {
    const kindLabel = 'Эксклюзивный контент';
    const title = kind === 'section'
      ? 'Войдите, чтобы открыть весь раздел'
      : 'Войдите, чтобы открыть продолжение';
    const text = kind === 'section'
      ? 'После входа будет доступен полный блок с дополнительными деталями.'
      : 'После входа откроется дополнительный материал с полезными нюансами.';
    const kindStyle = kind === 'section'
      ? 'bg-slate-100/90 dark:bg-slate-800/42'
      : 'bg-zinc-100/90 dark:bg-zinc-800/38';
    const animatedBg = kind === 'section'
      ? 'radial-gradient(120% 160% at 5% 5%, rgba(148,163,184,0.16) 0%, rgba(148,163,184,0) 48%), radial-gradient(120% 160% at 95% 95%, rgba(100,116,139,0.12) 0%, rgba(100,116,139,0) 52%), linear-gradient(140deg, rgba(248,250,252,0.92) 0%, rgba(241,245,249,0.88) 100%)'
      : 'radial-gradient(120% 160% at 5% 5%, rgba(161,161,170,0.16) 0%, rgba(161,161,170,0) 48%), radial-gradient(120% 160% at 95% 95%, rgba(113,113,122,0.12) 0%, rgba(113,113,122,0) 52%), linear-gradient(140deg, rgba(250,250,250,0.92) 0%, rgba(244,244,245,0.88) 100%)';
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
        <h3 class="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">${title}</h3>
        <p class="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">${text}</p>
        <a
          href="/?auth-needed=true"
          onclick="try{var p=(window.location.pathname||'/')+(window.location.search||'')+(window.location.hash||'');localStorage.setItem('back-to',p.replace(/^\\//,''));}catch(e){}"
          class="mt-4 inline-flex items-center rounded-full border border-transparent px-5 py-2 text-sm font-semibold leading-none transition hover:brightness-[1.03]"
          style="background:linear-gradient(rgba(255,255,255,0.94),rgba(255,255,255,0.94)) padding-box,linear-gradient(90deg,#3b82f6 0%,#10b981 100%) border-box;"
        >
          <span class="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">Посмотреть</span>
        </a>
        </div>
      </section>
    `;
  };

  const renderAuthorizedExclusive = (innerHtml: string, kind: 'block' | 'section') => {
    const kindBadge = 'эксклюзив';
    const kindBackground = kind === 'section'
      ? 'linear-gradient(145deg, rgba(241,245,249,0.58) 0%, rgba(226,232,240,0.44) 52%, rgba(241,245,249,0.5) 100%)'
      : 'linear-gradient(145deg, rgba(244,244,245,0.56) 0%, rgba(228,228,231,0.42) 52%, rgba(244,244,245,0.5) 100%)';
    const kindAccent = kind === 'section'
      ? 'radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0) 56%), radial-gradient(120% 140% at 100% 100%, rgba(148,163,184,0.16) 0%, rgba(148,163,184,0) 62%)'
      : 'radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.54) 0%, rgba(255,255,255,0) 56%), radial-gradient(120% 140% at 100% 100%, rgba(113,113,122,0.15) 0%, rgba(113,113,122,0) 62%)';
    const kindGlint = kind === 'section'
      ? 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.36) 46%, rgba(255,255,255,0) 100%)'
      : 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.34) 46%, rgba(255,255,255,0) 100%)';
    const innerPadding = kind === 'section'
      ? 'px-4 pb-4 pt-2.5'
      : 'px-4 py-3';
    return `
      <section class="relative my-6 overflow-hidden rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_28px_rgba(15,23,42,0.06)]" style="background:${kindBackground};backdrop-filter:blur(10px) saturate(130%);-webkit-backdrop-filter:blur(10px) saturate(130%);" data-protected="true" data-protected-kind="${kind}">
        <div aria-hidden="true" class="pointer-events-none absolute inset-0" style="background-image:${kindAccent};"></div>
        <div aria-hidden="true" class="pointer-events-none absolute -inset-y-full left-[-42%] w-[34%]" style="background:${kindGlint};transform:skewX(-17deg);animation:exclusiveSheen 6s ease-in-out infinite;"></div>
        <div class="relative px-4 pt-2 text-[10px] font-medium tracking-[0.02em] text-slate-500 dark:text-slate-500">${kindBadge}</div>
        <div class="relative ${innerPadding}">${innerHtml}</div>
      </section>
    `;
  };

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
  `);

  const flushOpenSpoiler = () => {
    if (!isSpoilerOpen) return;
    if (!isAuthorized) {
      parts.push(renderUnauthorizedProtected('section'));
    } else {
      parts.push(renderAuthorizedExclusive(openSpoilerInner.join(''), 'section'));
    }
    openSpoilerInner = [];
    isSpoilerOpen = false;
  };

  const pushContent = (html: string) => {
    if (!html) return;
    if (isSpoilerOpen && isAuthorized) {
      openSpoilerInner.push(html);
      return;
    }
    if (isSpoilerOpen && !isAuthorized) {
      return;
    }
    parts.push(html);
  };

  for (const [index, block] of blocks.entries()) {
    const type = String(block?.type || 'paragraph').trim();
    const content = String(block?.content || '').trim();
    const attrs = normalizeBlockAttrs(type, parseAttrsJson(block?.attrsJson));

    if (type === 'spoiler_open') {
      flushOpenSpoiler();
      isSpoilerOpen = true;
      continue;
    }

    if (type === 'spoiler_close') {
      flushOpenSpoiler();
      continue;
    }

    if (type === 'image') {
      const src = safeImageSrc(String(attrs.src || attrs.s || ''));
      if (!src) continue;
      const alt = escapeHtml(String(attrs.alt || attrs.a || attrs.imageAlt || ''));
      const caption = String(attrs.caption || '').trim();
      pushContent(
        `<figure class="my-6">` +
        `<img src="${escapeHtml(src)}" alt="${alt}" class="w-full rounded-2xl border border-gray-200 object-cover dark:border-gray-700" loading="lazy" decoding="async" />` +
        (caption ? `<figcaption class="mt-2 text-sm text-slate-500 dark:text-slate-400">${caption}</figcaption>` : '') +
        `</figure>`
      );
      continue;
    }

    if (type === 'html') {
      if (content) pushContent(`<div class="my-4">${content}</div>`);
      continue;
    }

    if (type === 'h2' || type === 'h3' || type === 'h4' || type === 'h5') {
      if (!content) continue;
      const baseAnchor = slugifyAnchor(content, index);
      const anchorCount = headingAnchorCounts.get(baseAnchor) || 0;
      headingAnchorCounts.set(baseAnchor, anchorCount + 1);
      const anchorId = anchorCount === 0 ? baseAnchor : `${baseAnchor}-${anchorCount + 1}`;
      const classes = {
        h2: 'mt-10 mb-3 text-3xl font-bold text-gray-900 dark:text-gray-100',
        h3: 'mt-8 mb-3 text-2xl font-bold text-gray-900 dark:text-gray-100',
        h4: 'mt-7 mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100',
        h5: 'mt-6 mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100',
      } as const;
      pushContent(`<${type} id="${escapeHtml(anchorId)}" class="scroll-mt-28 ${classes[type as keyof typeof classes]}">${content}</${type}>`);
      continue;
    }

    if (type === 'ul' || type === 'ol') {
      if (!content) continue;
      const listTag = type;
      pushContent(`<${listTag} class="my-4 list-${listTag === 'ul' ? 'disc' : 'decimal'} space-y-1 pl-6 text-base leading-7 text-gray-700 dark:text-gray-300">${content}</${listTag}>`);
      continue;
    }

    if (type === 'quote') {
      if (content) pushContent(`<blockquote class="my-6 border-l-4 border-blue-300 pl-5 italic text-gray-600 dark:border-blue-600 dark:text-gray-400">${content}</blockquote>`);
      continue;
    }

    if (type === 'callout') {
      const calloutType = String(attrs.calloutType || 'info').trim();
      const calloutClasses = {
        info: 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900',
        warning: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900',
        success: 'bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900',
      }[calloutType] || 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900';
      pushContent(`<div class="my-6 rounded-xl p-4 ${calloutClasses}">${content}</div>`);
      continue;
    }

    if (type === 'button') {
      const kind = String(attrs.kind || 'custom').trim().toLowerCase();
      const variant = String(attrs.variant || '').trim() || 'solid';
      const label = escapeHtml(String(attrs.text || '').trim() || (kind === 'login' ? 'Войти' : 'Подробнее'));
      const href = kind === 'login'
        ? '/?auth-needed=true'
        : safeLinkHref(String(attrs.href || ''));
      if (!href) continue;

      const isAnchor = href.startsWith('#');
      const shouldOpenInNewTab = Boolean(attrs.newTab) && !isAnchor && kind !== 'login';
      const target = shouldOpenInNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
      const clickHandler = kind === 'login' ? ` onclick="${authBackToOnClick}"` : '';

      pushContent(
        `<div class="my-8">` +
        `<a href="${escapeHtml(href)}"${target}${clickHandler} class="${buttonVariantClass(variant)}"><span>${label}</span><span aria-hidden="true" class="text-base leading-none transition duration-200 group-hover:translate-x-0.5">→</span></a>` +
        `</div>`
      );
      continue;
    }

    if (type === 'faq') {
      const items = Array.isArray(attrs.items) ? attrs.items : [];
      const validItems = items.filter((item: any) => {
        const q = String(item?.q || '').trim();
        const a = String(item?.a || '').trim();
        return !!q && !!a;
      });
      if (!validItems.length) continue;

      const faqHtml = validItems.map((item: any) => {
        const q = escapeHtml(String(item.q || '').trim());
        const a = escapeHtml(String(item.a || '').trim()).replace(/\n/g, '<br>');
        return (
          `<details class="group rounded-2xl border border-slate-200/90 bg-white/95 px-5 py-4 shadow-[0_8px_28px_rgba(15,23,42,0.05)] transition hover:border-blue-200 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-blue-800/70" data-faq-item>` +
          `<summary class="flex cursor-pointer list-none items-start justify-between gap-4 pr-0 text-base font-semibold leading-6 text-slate-900 marker:content-none dark:text-slate-50" data-faq-question><span>${q}</span><span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition group-open:rotate-45 group-open:border-blue-200 group-open:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:group-open:border-blue-800 dark:group-open:text-blue-300">+</span></summary>` +
          `<div class="mt-3 border-t border-slate-100 pt-3 text-[15px] leading-7 text-slate-600 dark:border-slate-800 dark:text-slate-300" data-faq-answer>${a}</div>` +
          `</details>`
        );
      }).join('');

      pushContent(`<section class="my-10 space-y-4" data-faq-block>${faqHtml}</section>`);
      continue;
    }

    if (type === 'spoiler') {
      if (!isAuthorized) {
        pushContent(renderUnauthorizedProtected('block'));
        continue;
      }

      pushContent(renderAuthorizedExclusive(`<div class="text-sm leading-7 text-slate-700 dark:text-slate-300">${content}</div>`, 'block'));
      continue;
    }

    if (type === 'divider') {
      pushContent('<hr class="my-8 border-slate-200 dark:border-slate-700" />');
      continue;
    }

    if (content) {
      pushContent(`<p class="my-4 text-base leading-7 text-gray-700 dark:text-gray-300">${content}</p>`);
    }
  }

  flushOpenSpoiler();

  if (!parts.length) return fallbackText;
  return parts.join('');
}

const PUBLIC_PUBLICATIONS_QUERY = `
  query PublicPublications($filter: PublicationListFilterInput) {
    publicPublications(filter: $filter) {
      items {
        slug
        category
        title
        status
        visibility
        excerpt
        author
        publishedAtUnix
      }
    }
  }
`;

const CONSOLE_PUBLICATIONS_QUERY = `
  query ConsolePublications($filter: PublicationListFilterInput) {
    consolePublications(filter: $filter) {
      items {
        slug
        category
        title
        excerpt
        author
        publishedAtUnix
      }
    }
  }
`;

const PUBLIC_PUBLICATION_BY_ROUTE_QUERY = `
  query PublicPublicationByRoute($category: PublicationCategory!, $slug: String!, $includeBlocks: Boolean!) {
    publicPublicationByRoute(category: $category, slug: $slug, includeBlocks: $includeBlocks) {
      slug
      category
      title
      excerpt
      author
      authorRole
      publishedAtUnix
      tags
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
      canonicalUrl
      robots
      blocks @include(if: $includeBlocks) {
        id
        type
        content
        attrsJson
      }
    }
  }
`;

const GQL_CATEGORIES = ['BLOG', 'WHATSNEW', 'ARTICLES', 'LEARNING', 'NEWS'] as const;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const config = useRuntimeConfig(event);
  const forwardedHost = String(getHeader(event, 'x-forwarded-host') || '').trim();
  const host = String(getHeader(event, 'host') || '').trim();
  const forwardedProto = String(getHeader(event, 'x-forwarded-proto') || '').trim().toLowerCase();
  const proto = forwardedProto === 'https' ? 'https' : 'http';
  const authToken = String(getCookie(event, 'auth_token') || getCookie(event, 'token') || '').trim();
  const isAuthorized = !!authToken;
  const category = String(query.category || '').trim().toLowerCase();
  const slug = String(query.slug || '').trim().toLowerCase();
  const includeDraft = String(query.includeDraft || 'false').toLowerCase() === 'true';

  const capitalUrl = String(getApiBaseUrl('capital') || '').replace(/\/$/, '');
  const requestOrigin = (forwardedHost || host) ? `${proto}://${forwardedHost || host}`.replace(/\/$/, '') : '';
  const envCapital = String(process.env.VITE_API_CAPITAL || '').trim().replace(/\/$/, '');
  const localDevCapital = process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:8082' : '';

  const endpointCandidates = [
    requestOrigin ? `${requestOrigin}/api-capital/query` : '',
    `${capitalUrl}/query`,
    localDevCapital ? `${localDevCapital}/query` : '',
    envCapital ? `${envCapital}/query` : '',
    envCapital ? `${envCapital}/api-capital/query` : '',
  ].filter((value, index, arr) => !!value && arr.indexOf(value) === index);

  async function queryCapital<T>(payload: { query: string; variables?: Record<string, any> }): Promise<T> {
    let lastError: unknown = null;
    for (const endpoint of endpointCandidates) {
      try {
        return await $fetch<T>(endpoint, {
          method: 'POST',
          body: payload,
          headers: authToken
            ? {
                authorization: `Bearer ${authToken}`,
                capitalauthorization: `Bearer ${authToken}`,
              }
            : undefined,
        }) as T;
      } catch (error) {
        lastError = error;
      }
    }

    throw (lastError || createError({ statusCode: 502, statusMessage: 'Capital endpoint is not configured' }));
  }

  async function enrichItemsWithFeaturedImage<T extends {
    slug: string;
    category: string;
    meta: Record<string, any>;
  }>(items: T[]): Promise<T[]> {
    if (!Array.isArray(items) || !items.length) return items;

    const details = await Promise.all(
      items.map(async (item) => {
        const slugValue = String(item.slug || '').trim().toLowerCase();
        const categoryValue = String(item.category || '').trim().toLowerCase();
        const gqlCategory = categoryValue.toUpperCase();
        if (!slugValue || !GQL_CATEGORIES.includes(gqlCategory as typeof GQL_CATEGORIES[number])) {
          return null;
        }

        try {
          const routeResponse = await queryCapital<PublicPublicationByRouteResponse>({
            query: PUBLIC_PUBLICATION_BY_ROUTE_QUERY,
            variables: {
              category: gqlCategory,
              slug: slugValue,
              includeBlocks: true,
            },
          });

          if (routeResponse.errors?.length) return null;
          const publication = routeResponse.data?.publicPublicationByRoute;
          if (!publication) return null;

          const ogImage = String(publication.ogImage || '').trim();
          if (ogImage) {
            return { slug: slugValue, category: categoryValue, ogImage };
          }

          for (const block of Array.isArray(publication.blocks) ? publication.blocks : []) {
            if (String(block?.type || '').trim() !== 'image') continue;
            const attrs = normalizeBlockAttrs('image', parseAttrsJson(String(block?.attrsJson || '')));
            const src = safeImageSrc(String(attrs.src || attrs.s || ''));
            if (src) return { slug: slugValue, category: categoryValue, ogImage: src };
          }

          return null;
        } catch {
          return null;
        }
      })
    );

    const imageByKey = new Map<string, string>();
    for (const detail of details) {
      if (!detail?.ogImage) continue;
      imageByKey.set(`${detail.category}:${detail.slug}`, detail.ogImage);
    }

    return items.map((item) => {
      const key = `${String(item.category || '').trim().toLowerCase()}:${String(item.slug || '').trim().toLowerCase()}`;
      const ogImage = imageByKey.get(key);
      if (!ogImage) return item;
      return {
        ...item,
        meta: {
          ...item.meta,
          og_image: ogImage,
          featured_image: ogImage,
        },
      };
    });
  }

  // Slug-first resolution works for all categories and does not depend on list permissions.
  if (slug) {
    const preferred = category ? category.toUpperCase() : '';
    const categories = [preferred, ...GQL_CATEGORIES].filter((value, index, arr) => !!value && arr.indexOf(value) === index);

    for (const gqlCategory of categories) {
      try {
        const routeResponse = await queryCapital<PublicPublicationByRouteResponse>({
          query: PUBLIC_PUBLICATION_BY_ROUTE_QUERY,
          variables: {
            category: gqlCategory,
            slug,
            includeBlocks: true,
          },
        });

        if (routeResponse.errors?.length) continue;

        const publication = routeResponse.data?.publicPublicationByRoute;
        if (!publication) continue;

        const dateIso = toIsoDate(publication.publishedAtUnix) || new Date().toISOString();

        const categorySlug = String(publication.category || 'news').trim().toLowerCase();
        const resolvedSlug = String(publication.slug || slug).trim().toLowerCase();

        return {
          items: [
            {
              slug: resolvedSlug,
              category: categorySlug,
              status: 'published' as const,
              meta: {
                slug: resolvedSlug,
                category: categorySlug,
                title: String(publication.title || '').trim(),
                description: String(publication.excerpt || '').trim(),
                author: String(publication.author || 'Lota Team').trim(),
                author_role: String(publication.authorRole || '').trim(),
                date: dateIso,
                tags: Array.isArray(publication.tags) ? publication.tags : [],
                og_image: String(publication.ogImage || '').trim(),
                schema_type: String(publication.schemaType || '').trim(),
                source_url: String(publication.sourceUrl || '').trim(),
                source_name: String(publication.sourceName || '').trim(),
                reviewed_by: String(publication.reviewedBy || '').trim(),
                reviewed_by_url: String(publication.reviewedByUrl || '').trim(),
                reviewed_date: toIsoDate(publication.reviewedDateUnix),
                publisher_name: String(publication.publisherName || '').trim(),
                publisher_url: String(publication.publisherUrl || '').trim(),
                publisher_logo: String(publication.publisherLogo || '').trim(),
                canonical_url: String(publication.canonicalUrl || '').trim(),
                robots: String(publication.robots || '').trim(),
              },
              body: blocksToHtml(publication.blocks, String(publication.excerpt || '').trim(), { isAuthorized }),
            },
          ],
        };
      } catch {
        // Try next category candidate.
      }
    }
  }

  try {
    const response = await queryCapital<PublicPublicationListResponse>({
      query: PUBLIC_PUBLICATIONS_QUERY,
      variables: {
        filter: {
          ...(category ? { category: category.toUpperCase() } : {}),
          page: 1,
          pageSize: 300,
          includeDraft,
        },
      },
    });

    if (!response.errors?.length) {
      const items = (response.data?.publicPublications?.items || [])
        .map((item) => {
          const slug = String(item?.slug || '').trim().toLowerCase();
          if (!slug) return null;

          const categorySlug = String(item?.category || 'news').trim().toLowerCase();
          const dateIso = toIsoDate(item?.publishedAtUnix) || new Date().toISOString();

          return {
            slug,
            category: categorySlug,
            status: 'published' as const,
            meta: {
              slug,
              category: categorySlug,
              title: String(item?.title || '').trim(),
              description: String(item?.excerpt || '').trim(),
              author: String(item?.author || 'Lota Team').trim(),
              date: dateIso,
              tags: [],
              robots: 'index,follow',
            },
            body: String(item?.excerpt || '').trim(),
          };
        })
        .filter((item): item is NonNullable<typeof item> => !!item);

      if (items.length > 0) {
        const enrichedItems = await enrichItemsWithFeaturedImage(items);
        return { items: enrichedItems };
      }
    }
  } catch {
    // Fall through to legacy sources.
  }

  // In local/dev setups, public list may be auth-guarded unexpectedly.
  // If user has a token, fallback to console list but keep only published items.
  if (isAuthorized) {
    try {
      const response = await queryCapital<ConsolePublicationListResponse>({
        query: CONSOLE_PUBLICATIONS_QUERY,
        variables: {
          filter: {
            ...(category ? { category: category.toUpperCase() } : {}),
            status: 'PUBLISHED',
            page: 1,
            pageSize: 300,
            includeDraft,
          },
        },
      });

      if (!response.errors?.length) {
        const items = (response.data?.consolePublications?.items || [])
          .map((item) => {
            const slug = String(item?.slug || '').trim().toLowerCase();
            if (!slug) return null;

            const categorySlug = String(item?.category || 'news').trim().toLowerCase();
            const dateIso = toIsoDate(item?.publishedAtUnix) || new Date().toISOString();

            return {
              slug,
              category: categorySlug,
              status: 'published' as const,
              meta: {
                slug,
                category: categorySlug,
                title: String(item?.title || '').trim(),
                description: String(item?.excerpt || '').trim(),
                author: String(item?.author || 'Lota Team').trim(),
                date: dateIso,
                tags: [],
                robots: 'index,follow',
              },
              body: String(item?.excerpt || '').trim(),
            };
          })
          .filter((item): item is NonNullable<typeof item> => !!item);

        if (items.length > 0) {
          const enrichedItems = await enrichItemsWithFeaturedImage(items);
          return { items: enrichedItems };
        }
      }
    } catch {
      // Continue to legacy sources.
    }
  }

  const upstreamBaseUrl = String(config.publicationsBackendUrl || '').trim();
  const upstreamItems = await fetchPublicationDocumentsFromUpstream(upstreamBaseUrl, {
    includeDraft,
    category: category || undefined,
  });
  if (upstreamItems) {
    return { items: upstreamItems };
  }

  const items = await listPublicationDocuments({
    includeDraft,
    category: category || undefined,
  });

  return { items };
});
