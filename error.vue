<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps({
  error: Object as () => NuxtError
})

const handleError = () => clearError({ redirect: '/' })

const messages = [
  "Вас тут быть не должно... 🚷",
  "Что-то пошло не по плану! 🤦‍♂️",
  "Все в порядке? 🤔",
  "Странная ошибка... 🧐",
  "Но как вы сюда попали? 🤨",
  "Так быть не должно! ❌",
  "Вы нашли секретную страницу! 🎉",
  "'Работает, не трогай', говорили они... 🤦‍♂️",
  "Ошибка? Или фича? 🤷‍♂️",
  "Мы тут не ожидали гостей... 🏡",
  "Кто-то явно что-то сломал... 🛠️",
  "404? Возможно, но мы не уверены! 🤯",
  "Ошибка найдена, сохраните этот момент! 📸",
  "Это тайное место! 🔒",
  "Где-то на сервере кто-то сейчас паникует... 😱",
  "Вы слишком глубоко копаете... ⛏️",
  "Всякое случается, даже такое... 🤷",
  "Привет, искатель приключений! 🏕️",
  "Этот маршрут не найден... пока что. 🗺️",
  "Здесь должен был быть контент, но он ушёл за хлебом 20 лет назад. 🍞"
]

const subtitles = [
  "Ошибка найдена, но кем?",
  "Может быть, это фича?",
  "Скоро всё наладится!",
  "Пора бы вернуться обратно",
  "Куда вы кликнули?",
  "В следующий раз попробуйте другой путь!",
  "Система в лёгком шоке",
  "Тут ничего интересного, правда",
  "Мы уже чиним (наверное)...",
  "Вселенная сказала 'нет'.",
  "Где-то заплакал один разраб...",
  "Ну вот, опять сломали...",
  "Эта страница была, но потом исчезла!",
  "Не волнуйтесь, мы тоже не знаем, что произошло.",
  "Это не ошибка, это новый функционал!",
  "Мы тестируем вашу реакцию.",
  "Вероятность этой ошибки – 0.0001%. И вот вы её поймали!",
  "Надо же...",
  "Если что, мы так и задумали!",
  "Баг репорт отправлен в параллельную вселенную.",
  "Не переживайте, ваш Wi-Fi не виноват.",
  "Разработчик уже меняет статус поиска работы!"
]

const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

const randomMessage = getRandom(messages)
const randomSubtitle = getRandom(subtitles)
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen dark:bg-gray-900 dark:text-white text-center">
    <div class="max-w-lg p-8 rounded-xl bg-gray-50 dark:bg-gray-800 shadow-lg">
      <h1 class="text-6xl font-bold text-red-500">{{ error.statusCode }}</h1>
      <p class="text-xl font-semibold mt-3">{{ randomMessage }}</p>
      <p class="text-lg mt-2 opacity-80">{{ randomSubtitle }}</p>

      <UButton @click="handleError" class="mt-5" label="Вернуться на главную" color="primary" variant="outline">
        <template #leading>
          <UIcon name="i-heroicons-arrow-left-20-solid" class="w-5 h-5" />
        </template>
      </UButton>
    </div>
  </div>
</template>