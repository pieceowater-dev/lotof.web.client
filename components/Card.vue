<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();
import { useClipboard } from '@vueuse/core';
import { dynamicLS } from '@/utils/storageKeys';
import PinPrompt from '@/components/PinPrompt.vue';

type Post = {
        id: string;
        title: string;
        description?: string | null;
        location?: { address?: string | null; city?: string | null; country?: string | null } | null;
};

const props = withDefaults(defineProps<{ post: Post; canDelete?: boolean; selected?: boolean }>(), { canDelete: false, selected: false });
const emit = defineEmits<{ (e: 'edit', post: Post): void; (e: 'delete', post: Post): void; (e: 'select', post: Post): void }>();

function onEdit(e: MouseEvent) {
        e.stopPropagation();
        emit('edit', props.post);
}
function onDelete(e: MouseEvent) {
        e.stopPropagation();
        emit('delete', props.post);
}
const locationText = computed(() => {
        const parts = [props.post.location?.address || '', props.post.location?.city || ''].filter(Boolean)
        return parts.join(', ')
});

const hasDescription = computed(() => !!(props.post.description && props.post.description.trim().length > 0));

const { copy } = useClipboard();
const qrPrintDialog = ref(false);
const qrImage = ref<string | null>(null);

const publicUrl = computed(() => {
    return `${window.location.origin}/shared/ns/atrace/post/${props.post.id}`;
});

async function handleCopy() {
    await copy(publicUrl.value);
}
function handleOpen() {
    window.open(publicUrl.value, '_blank');
}
async function handlePrint() {
    const { qrGenPublic } = await import('@/api/atrace/record/qrgen');
    // Try to extract namespace from publicUrl or props if available
    let ns = '';
    // Try to parse from publicUrl
    try {
        const match = publicUrl.value.match(/\/shared\/(.*?)\//);
        if (match && match[1]) ns = match[1];
    } catch {}
    // skip props.post.namespace (not in type)
    if (!ns) ns = 'ns'; // fallback, but should be dynamic

    // Get PIN from localStorage
    const pinKey = dynamicLS.atracePostPin(ns, props.post.id);
        let pin = '';
        if (typeof window !== 'undefined') {
            pin = localStorage.getItem(pinKey) || '';
        }
        if (!pin) {
            showPrintPinPrompt.value = true;
            pendingPrint.value = { ns, postId: props.post.id };
            return;
        }
        await doPrintWithPin(pin, ns);
    }

    const showPrintPinPrompt = ref(false);
    const pendingPrint = ref<{ ns: string; postId: string } | null>(null);
    async function handlePrintPinSubmit(val: string) {
        if (!pendingPrint.value) return;
        await doPrintWithPin(val, pendingPrint.value.ns);
        showPrintPinPrompt.value = false;
        pendingPrint.value = null;
    }
    async function doPrintWithPin(pin: string, ns: string) {
        const { qrGenPublic } = await import('@/api/atrace/record/qrgen');
        const CryptoJS = (await import('crypto-js')).default;
        const secret = CryptoJS.MD5(pin).toString();
        const res = await qrGenPublic(props.post.id, 'METHOD_QR_STATIC', secret, ns);
        qrImage.value = res;
        qrPrintDialog.value = true;
        setTimeout(() => {
            const printWindow = window.open('', '_blank');
            if (printWindow && qrImage.value) {
                printWindow.document.write(`<img src='${qrImage.value}' style='width:300px;height:300px;display:block;margin:40px auto;' />`);
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
            }
        }, 200);
    }

const dropdownItems = [
    [
        {
            label: t('app.copyLink'),
            icon: 'i-lucide-copy',
            click: handleCopy,
        },
        {
            label: t('app.openInNewTab'),
            icon: 'i-lucide-external-link',
            click: handleOpen,
        },
        {
            label: t('app.printQr'),
            icon: 'i-lucide-printer',
            click: handlePrint,
        },
    ],
];
</script>

<template>
    <div @click="emit('select', post)"
        :class="selected ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'"
        class="shadow-md hover:shadow-sm p-4 rounded-xl w-60 cursor-pointer flex-shrink-0 min-h-[100px] h-full self-stretch flex flex-col">
        <div class="flex items-center gap-2 mb-2">
            <h3 class="text-lg font-semibold truncate min-w-0 flex-1" :title="post.title">{{ post.title }}</h3>
                                <div class="flex-none flex gap-1 items-center">
                                                    <UDropdown :items="dropdownItems" :popper="{ placement: 'bottom-end' }">
                                                        <UButton icon="i-lucide-qr-code" size="xs" color="primary" :variant="selected ? 'solid' : 'ghost'" aria-label="QR actions" />
                                                    </UDropdown>
                                        <UButton @click="onEdit" icon="i-lucide-pencil" size="xs" color="primary" :variant="selected ? 'solid' : 'ghost'" />
                                        <UButton v-if="canDelete" @click="onDelete" icon="i-lucide-trash-2" size="xs" color="red" :variant="selected ? 'solid' : 'ghost'" />
                                </div>

        </div>
        <p v-if="locationText" class="text-sm truncate" :class="selected ? 'text-white' : 'text-gray-600 dark:text-gray-100'"
           :title="locationText">
            {{ locationText }}
        </p>
        <!-- Flexible spacer to push bottom section down when there is little content -->
        <div class="flex-1"></div>
        <!-- Reserve space for one description line to keep cards equal height -->
        <div class="mt-1 h-5">
            <p v-if="hasDescription" class="text-xs truncate"
               :class="selected ? 'text-white/90' : 'text-gray-500 dark:text-gray-300'"
               :title="post.description || ''">
                {{ post.description }}
            </p>
        </div>
    </div>
<PinPrompt
    v-model="showPrintPinPrompt"
    :title="t('app.enterPin') || 'Enter PIN'"
    :description="t('app.pinPromptDesc') || 'Enter the 6-digit PIN for this post. The PIN was shown to the post creator and is required to print the QR.'"
    :error-text="t('app.pinMustBe6Digits') || 'PIN must be 6 digits'"
    @submit="handlePrintPinSubmit"
/>
</template>