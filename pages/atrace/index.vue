<script lang="ts" setup>
import Card from "@/components/Card.vue";

const posts = [
    { id: 1, title: "Офис А", address: "ул. Пушкина, 10" },
    { id: 2, title: "Офис Б", address: "ул. Лермонтова, 5" },
    { id: 3, title: "Склад", address: "ул. Чехова, 12" },
    { id: 4, title: "Филиал С", address: "ул. Гоголя, 8" },
    { id: 4, title: "Филиал С", address: "ул. Гоголя, 8" }
];
</script>

<template>
    <div class="h-screen flex flex-col">
        <div class="flex justify-between items-center mb-5 mt-5 px-4">
            <div class="text-left">
                <h1 class="text-3xl font-bold">A-Trace</h1>
                <span>Следите за посещаемостью своих сотрудников.</span>
            </div>
            <UButton icon="i-lucide-users" color="primary" variant="outline">Мои Сотрудники</UButton>
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
                <UButton icon="i-lucide-filter" color="primary" variant="outline">Фильтр</UButton>
                <UInput icon="i-lucide-search" size="md" variant="outline" placeholder="Search..." />
            </div>
        </div>



        <div class="flex-1 h-full px-4 pb-4 flex flex-col overflow-y-auto">
            <Table />
        </div>
    </div>
</template>