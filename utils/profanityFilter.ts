import leoProfanity from 'leo-profanity';

// Applied at display time everywhere user/tenant-entered free text reaches
// the page -- Patron review author/body, and business names/descriptions/
// tag names synced in from each tenant's own Menu category names (real
// example already seen live: a tenant named a category something explicit,
// which showed up unmasked as a catalog filter chip). Masking here, not at
// write time, so nothing already stored needs a migration and the mask
// keeps up if the word list changes later.
//
// leo-profanity ships English + Russian dictionaries built from the
// Shutterstock/LDNOOBW word lists. No comparable open-source Kazakh word
// list exists (checked LDNOOBW's list and its ~75-language V2 successor --
// neither has a kk entry), so KAZAKH_WORDS below is a small, hand-curated
// starter set covering the most common/severe terms, not an exhaustive
// list. Extend it here if something slips through.
const KAZAKH_WORDS = [
  'сігейін', 'сіктір', 'сіктірем', 'сіктір бар', ' котақ', 'қотақ',
  'көт', 'мамбет', 'сасық құл', 'жаман құл', 'ана сігейін', 'ебать',
  'қотан', 'боқ', 'боқмұрын', 'дырбек',
];

let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  leoProfanity.loadDictionary('en');
  leoProfanity.add(leoProfanity.getDictionary('ru'));
  leoProfanity.add(KAZAKH_WORDS);
  initialized = true;
}

// Masks whole-word matches only (leo-profanity splits on whitespace/,/.),
// so it won't false-positive on a legitimate word that merely contains a
// profane substring, but also won't catch spaced-out or symbol-substituted
// evasion -- a deliberate simplicity/false-positive tradeoff, matching
// what a single off-the-shelf library reasonably provides.
export function maskProfanity(text: string | null | undefined): string {
  if (!text) return text ?? '';
  ensureInitialized();
  return leoProfanity.clean(text);
}

export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  ensureInitialized();
  return leoProfanity.check(text);
}
