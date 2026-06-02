<template>
  <ConsoleEditor
    mode="create"
    storage-key="publication_editor_draft_new"
    :on-publish="onPublish"
  />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { capitalCreatePublication } from '@/api/publications'

definePageMeta({
  layout: false,
  middleware: 'admin'
})

const router = useRouter()
const toast = useToast()
const authToken = useCookie<string | null>('auth_token')
const legacyToken = useCookie<string | null>('token')

type EditorPayload = {
  article: Record<string, any>
  blocks: Array<Record<string, any>>
}

async function publishPublication(payload: EditorPayload) {
  const slug = await capitalCreatePublication(String(authToken.value || legacyToken.value || '').trim(), {
    ...payload.article,
    status: 'published',
  } as any, payload.blocks as any)

  if (!slug) return
  toast.add({
    title: 'Статья опубликована',
    color: 'green',
  })
  await router.replace('/console/publications')
}

async function onPublish(payload: EditorPayload) {
  await publishPublication(payload)
}
</script>
