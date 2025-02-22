<script lang="ts" setup>
import Card from "@/components/Card.vue";

const posts = [
    { id: 1, title: "Офис А", address: "ул. Пушкина, 10" },
    { id: 2, title: "Офис Б", address: "ул. Лермонтова, 5" },
    { id: 3, title: "Склад", address: "ул. Чехова, 12" },
    { id: 4, title: "Филиал С", address: "ул. Гоголя, 8" },
    { id: 4, title: "Филиал С", address: "ул. Гоголя, 8" }
];

const isOpen = ref(false)
const isFilterOpen = ref(false)
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
                        Сотрудники
                    </h3>
                    <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1"
                        @click="isOpen = false" />
                </div>
            </template>

            <span>Позже добавить сюда что-то</span>

            <Table />

            <Placeholder class="h-full" />
        </UCard>
    </UModal>

    <UModal v-model="isFilterOpen">
        <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                        Фильтр
                    </h3>
                    <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1"
                        @click="isFilterOpen = false" />
                </div>
            </template>

            <Placeholder class="h-64" />

            <template #footer>
                <div class="flex justify-between gap-2">
                    <UButton icon="i-heroicons-check" size="sm" color="primary" variant="solid"
                        label="Применить" :trailing="false" />
                    <UButton icon="i-heroicons-x-mark-20-solid" size="sm" color="primary" variant="outline"
                        label="Отменить" :trailing="false" />
                </div>
            </template>
        </UCard>
    </UModal>

    <div class="h-screen flex flex-col">
        <div class="flex justify-between items-center mb-5 mt-5 px-4">
            <div class="text-left">
                <h1 class="text-3xl font-bold">A-Trace</h1>
                <span>Следите за посещаемостью своих сотрудников.</span>
            </div>
            <UButton @click="isOpen = true" icon="i-lucide-users" color="primary" variant="outline">Мои Сотрудники
            </UButton>
        </div>

        <div class="overflow-x-auto whitespace-nowrap py-4 px-4">
            <div class="flex space-x-4">
                <div v-for="post in posts" :key="post.id">
                    <Card :post="post" />
                </div>
                <button
                    class="bg-blue-400 dark:bg-blue-900 text-white shadow-md p-4 rounded-xl w-60 flex items-center justify-center cursor-pointer hover:bg-blue-500 dark:hover:bg-blue-800 flex-shrink-0">
                    + Добавить локацию
                </button>
            </div>
        </div>

        <div class="flex justify-between items-center mb-5 mt-5 px-4">
            <div class="text-left">
                <h2 class="text-2xl font-bold">Посещаемость — Офис А</h2>
                <span>ул. Пушкина, 10. 01.02.25 - 28.02.25</span>
            </div>

            <div class="flex space-x-4">
                <UButton @click="isFilterOpen = true" icon="i-lucide-filter" color="primary" variant="outline">Фильтр
                </UButton>
                <UInput icon="i-lucide-search" size="md" variant="outline" placeholder="Search..." />
            </div>
        </div>



        <div class="flex-1 h-full px-4 pb-4 flex flex-col overflow-y-auto">
            <Table />
        </div>
    </div>
</template>