<template>
  <div class="bezel h-full" :class="props.action ? 'bezel-hover' : ''">
    <div class="bezel-core relative flex h-full min-h-[15rem] flex-col gap-5 overflow-hidden p-6 text-left sm:p-7">
      <UIcon
        :name="props.icon"
        class="pointer-events-none absolute -right-6 -bottom-8 h-40 w-40 text-gray-900 dark:text-white"
        style="opacity: 0.045"
      />

      <div class="relative flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h3 class="text-xl font-extrabold leading-snug tracking-tight text-gray-900 dark:text-white line-clamp-2">
            {{ props.title }}
          </h3>
          <p
            v-if="props.name"
            class="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-1"
          >
            {{ props.name }}
          </p>
          <span
            class="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap"
            :class="isInstalled || isAvailable
              ? 'text-blue-700 dark:text-blue-200'
              : 'text-slate-500 dark:text-gray-400'"
            :style="isInstalled || isAvailable
              ? 'background: rgba(37, 99, 235, 0.1); box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.2)'
              : 'background: rgba(15, 23, 42, 0.05); box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08)'"
          >
            {{ isInstalled ? (t('app.statusInstalled') || 'Installed') : (isAvailable ? (t('app.statusAvailable') || 'Available') : (t('app.statusComingSoon') || 'Coming soon')) }}
          </span>
        </div>

        <div class="icon-tile flex-shrink-0" :class="!isInstalled && !isAvailable ? 'opacity-60' : ''">
          <UIcon :name="props.icon" class="h-7 w-7" />
        </div>
      </div>

      <p class="relative text-sm leading-6 text-gray-600 dark:text-gray-300 line-clamp-3">
        {{ props.description }}
      </p>

      <div class="relative mt-auto flex flex-wrap items-center gap-2 pt-1">
        <component
          :is="props.to ? NuxtLinkC : 'button'"
          v-bind="props.to ? { to: props.to } : { type: 'button', disabled: !props.action }"
          class="cta-pill"
          :class="[
            (props.action || props.to) ? 'cta-pill--primary' : 'pointer-events-none opacity-60',
            '!px-5 !py-2 text-sm'
          ]"
          @click="props.to ? undefined : props.action?.()"
        >
          {{ props.installed ? t('app.open') : (props.canAdd ? t('app.getApp') : t('app.comingSoon')) }}
        </component>
        <!-- external storefront / public page — opens in a new tab so it's
             clearly a separate customer-facing site, not another admin screen -->
        <a
          v-if="props.installed && props.storefrontTo"
          :href="props.storefrontTo"
          target="_blank"
          rel="noopener"
          class="pill-outline !py-2"
        >
          {{ props.storefrontLabel || t('app.externalStorefront') || 'Витрина' }}
          <UIcon name="lucide:external-link" class="h-4 w-4" />
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, resolveComponent } from 'vue';
const NuxtLinkC = resolveComponent('NuxtLink');
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();

const props = defineProps<{
    icon: string
    title: string
    name?: string
    description: string
    to?: string
    action?: () => void | Promise<void>
    installed?: boolean // if false -> show "Get App"
    canAdd?: boolean
    storefrontTo?: string   // external customer-facing page (opens new tab)
    storefrontLabel?: string
}>();

const isInstalled = computed(() => !!props.installed);
const isAvailable = computed(() => !props.installed && !!props.canAdd);
</script>