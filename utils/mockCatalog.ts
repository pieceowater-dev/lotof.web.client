// Placeholder data for the Catalog / Stores / Services mock marketplace
// pages, reused consistently across pages/catalog.vue, pages/stores.vue,
// and pages/services.vue as a fallback for whichever sections don't have
// real data yet. rating/reviews/priceTier/distance are optional because
// real businesses (see utils/mapCatalogBusiness.ts) don't have any of that
// -- BusinessCard.vue hides each line when its data is missing rather than
// showing a fabricated number.
export interface MockBusiness {
  key: string;
  name: string;
  icon: string;
  gradient: string;
  iconColor: string;
  rating?: number;
  reviews?: number;
  priceTier?: string;
  distance?: string;
  badge?: string;
}

// lota Menu businesses -- cafes, restaurants, delivery (pages/stores.vue).
export const menuBusinesses: MockBusiness[] = [
  { key: 'p1', name: 'Cofix', icon: 'lucide:coffee', gradient: 'from-amber-200 to-orange-100', iconColor: 'text-amber-700', rating: 4.8, reviews: 214, priceTier: '$$', distance: '650 м', badge: 'Бесплатная доставка' },
  { key: 'p2', name: 'Osaka Sushi', icon: 'lucide:soup', gradient: 'from-rose-200 to-pink-100', iconColor: 'text-rose-700', rating: 4.6, reviews: 532, priceTier: '$$$', distance: '1.2 км', badge: '-20% на сеты' },
  { key: 'p3', name: 'Bahandy Pizza', icon: 'lucide:pizza', gradient: 'from-red-200 to-orange-100', iconColor: 'text-red-700', rating: 4.5, reviews: 187, priceTier: '$$', distance: '900 м' },
  { key: 'p4', name: 'Green Bowl', icon: 'lucide:salad', gradient: 'from-lime-200 to-yellow-100', iconColor: 'text-lime-700', rating: 4.9, reviews: 98, priceTier: '$$', distance: '400 м', badge: 'Новинка' },
  { key: 'p5', name: 'Своя Пекарня', icon: 'lucide:croissant', gradient: 'from-orange-200 to-amber-100', iconColor: 'text-orange-700', rating: 4.7, reviews: 156, priceTier: '$', distance: '300 м' },
  { key: 'p6', name: 'Wok Station', icon: 'lucide:soup', gradient: 'from-red-200 to-yellow-100', iconColor: 'text-red-700', rating: 4.4, reviews: 121, priceTier: '$$', distance: '1.5 км', badge: 'Быстрая доставка' },
];

// lota Plans businesses -- barbershops (pages/services.vue).
export const plansBarbershops: MockBusiness[] = [
  { key: 'b1', name: 'Barber Club', icon: 'lucide:scissors', gradient: 'from-blue-200 to-indigo-100', iconColor: 'text-blue-700', rating: 4.9, reviews: 341, priceTier: '$$$', distance: '750 м', badge: 'Топ недели' },
  { key: 'b2', name: 'Old Boy Barbershop', icon: 'lucide:scissors', gradient: 'from-slate-200 to-gray-100', iconColor: 'text-slate-700', rating: 4.7, reviews: 156, priceTier: '$$', distance: '1.5 км' },
  { key: 'b3', name: 'Gentleman Cut', icon: 'lucide:scissors', gradient: 'from-amber-200 to-yellow-100', iconColor: 'text-amber-800', rating: 4.6, reviews: 89, priceTier: '$$', distance: '2 км' },
  { key: 'b4', name: 'Fresh Fade', icon: 'lucide:scissors', gradient: 'from-stone-200 to-neutral-100', iconColor: 'text-stone-700', rating: 4.8, reviews: 203, priceTier: '$$$', distance: '1.1 км', badge: 'Запись онлайн' },
];

// lota Plans businesses -- beauty & wellness (pages/services.vue).
export const plansBeauty: MockBusiness[] = [
  { key: 'n1', name: 'Nail Bar', icon: 'lucide:sparkles', gradient: 'from-pink-200 to-rose-100', iconColor: 'text-pink-700', rating: 4.9, reviews: 278, priceTier: '$$', distance: '500 м', badge: 'Топ недели' },
  { key: 'n2', name: 'Beauty Room', icon: 'lucide:wand-2', gradient: 'from-fuchsia-200 to-purple-100', iconColor: 'text-fuchsia-700', rating: 4.7, reviews: 145, priceTier: '$$$', distance: '1.3 км' },
  { key: 'n3', name: 'Lash & Brow Studio', icon: 'lucide:eye', gradient: 'from-violet-200 to-indigo-100', iconColor: 'text-violet-700', rating: 4.8, reviews: 167, priceTier: '$$', distance: '900 м', badge: 'Скидка -15%' },
  { key: 'n4', name: 'SPA Wellness', icon: 'lucide:flower-2', gradient: 'from-violet-200 to-purple-100', iconColor: 'text-violet-700', rating: 4.9, reviews: 302, priceTier: '$$$$', distance: '2.4 км' },
];

export interface MockReview {
  key: string;
  author: string;
  business: string;
  rating: number;
  date: string;
  text: string;
}

export const mockReviews: MockReview[] = [
  { key: 'r1', author: 'Айгерим К.', business: 'Cofix', rating: 5, date: '2 дня назад', text: 'Быстро приготовили, кофе всегда свежий. Заказываю каждое утро через приложение.' },
  { key: 'r2', author: 'Данияр С.', business: 'Barber Club', rating: 5, date: 'неделю назад', text: 'Записался онлайн за пару кликов, без звонков. Мастер отличный, стрижкой доволен.' },
  { key: 'r3', author: 'Мадина Т.', business: 'Nail Bar', rating: 4, date: '3 дня назад', text: 'Уютно, аккуратно, но пришлось немного подождать своей записи.' },
  { key: 'r4', author: 'Ерлан Б.', business: 'Osaka Sushi', rating: 5, date: 'вчера', text: 'Заказ привезли даже раньше срока, всё было горячим и свежим.' },
];
