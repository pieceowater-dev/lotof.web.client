<script lang="ts" setup>
import Card from "@/components/Card.vue";
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();

const posts = [
    { id: 1, title: "Office A", address: "Pushkina st, 10" },
    { id: 2, title: "Office B", address: "Lermontova st, 5" },
    { id: 3, title: "Warehouse", address: "Chekhova st, 12" },
    { id: 4, title: "Branch C", address: "Gogolya st, 8" },
    { id: 4, title: "Branch C", address: "Gogolya st, 8" }
];

const isOpen = ref(false)
const isFilterOpen = ref(false)

// Redirect to home if atrace token missing or expired
const router = useRouter();
onMounted(() => {
    const cookie = useCookie<string | null>('atrace-token', { path: '/' });
    const tok = cookie.value;
    if (!tok) {
        // Give one microtask in case the cookie was just set
        setTimeout(() => { if (!cookie.value) router.push('/'); }, 0);
        return;
    }
    try {
        // Basic JWT exp check: header.payload.signature
        const parts = tok.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const expSec = payload.exp as number | undefined;
            if (expSec && Date.now() / 1000 >= expSec) {
                // expired
                cookie.value = null;
                setTimeout(() => router.push('/'), 0);
            }
        }
    } catch {}
})
</script>

<template>
    <UModal v-model="isOpen" fullscreen>
        <UCard :ui="{
            base: 'h-full flex flex-col',
            rounded: '',
            divide: 'divide-y divide-gray-100 dark:divide-gray-800',
            body: {
                base: 'grow'
            }
        }">
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                        People
                    </h3>
                    <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1"
                        @click="isOpen = false" />
                </div>
            </template>

            <span>Placeholder area (to be extended later)</span>

            <Table />

            <Placeholder class="h-full" />
        </UCard>
    </UModal>

    <UModal v-model="isFilterOpen">
        <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                        Filter
                    </h3>
                    <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1"
                        @click="isFilterOpen = false" />
                </div>
            </template>

            <Placeholder class="h-64" />

            <template #footer>
                <div class="flex justify-between gap-2">
                    <UButton icon="lucide:check" size="sm" color="primary" variant="solid"
                        label="Apply" :trailing="false" />
                    <UButton icon="lucide:x" size="sm" color="primary" variant="outline"
                        label="Cancel" :trailing="false" />
                </div>
            </template>
        </UCard>
    </UModal>

    <div class="h-screen flex flex-col">
        <div class="flex justify-between items-center mb-5 mt-5 px-4">
            <div class="text-left">
                <h1 class="text-3xl font-bold">{{ t('app.atraceTitle') }}</h1>
                <span>{{ t('app.atraceSubtitle') }}</span>
            </div>
            <UButton @click="isOpen = true" icon="lucide:users" color="primary" variant="outline">My People
            </UButton>
        </div>

        <div class="overflow-x-auto whitespace-nowrap py-4 px-4">
            <div class="flex space-x-4">
                <div v-for="post in posts" :key="post.id">
                    <Card :post="post" />
                </div>
                <button
                    class="bg-blue-400 dark:bg-blue-900 text-white shadow-md p-4 rounded-xl w-60 flex items-center justify-center cursor-pointer hover:bg-blue-500 dark:hover:bg-blue-800 flex-shrink-0">
                    {{ t('app.atraceAddLocation') }}
                </button>
            </div>
        </div>

        <div class="flex justify-between items-center mb-5 mt-5 px-4">
            <div class="text-left">
                <h2 class="text-2xl font-bold">{{ t('app.atraceAttendanceTitle') }}</h2>
                <span>{{ t('app.atraceAttendanceRange') }}</span>
            </div>

            <div class="flex space-x-4">
                <UButton @click="isFilterOpen = true" icon="lucide:filter" color="primary" variant="outline">{{ t('app.atraceFilter') }}
                </UButton>
                <UInput icon="lucide:search" size="md" variant="outline" :placeholder="t('app.atraceSearch')" />
            </div>
        </div>



        <div class="flex-1 h-full px-4 pb-4 flex flex-col overflow-y-auto">
            <Table />
        </div>
    </div>
</template>