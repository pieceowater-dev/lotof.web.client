import { computed } from 'vue';
import { useGoodsAuth } from '@/composables/useGoodsAuth';
import { formatMoney } from '@/utils/currency';

// One way to show an amount of money on every Goods screen: grouped thousands,
// no ".00" on whole sums, and the namespace's currency sign (the register
// already did this; catalog, reports, suppliers and documents printed bare
// "5000.00"). The currency comes from the namespace's Goods settings, fetched
// once per namespace and shared; until it arrives the default (KZT) shows.
export function useGoodsMoney() {
  const route = useRoute();
  const nsSlug = computed(() => route.params.namespace as string);
  const currencies = useState<Record<string, string>>('goods-currency', () => ({}));
  const requested = new Set<string>();

  async function load() {
    const ns = nsSlug.value;
    if (!ns || currencies.value[ns] || requested.has(ns)) return;
    requested.add(ns);
    try {
      const token = await useGoodsAuth().getToken(ns);
      const { goodsGetSettings } = await import('@/api/goods/settings');
      const settings = await goodsGetSettings(token, ns);
      if (settings.currency) currencies.value = { ...currencies.value, [ns]: settings.currency };
    } catch {
      requested.delete(ns);
    }
  }
  if (import.meta.client) onMounted(() => { void load(); });

  /** Amount in minor units (cents) -> «5 000 ₸». */
  const money = (cents: number | null | undefined) => formatMoney((cents ?? 0) / 100, currencies.value[nsSlug.value]);
  return { money };
}
