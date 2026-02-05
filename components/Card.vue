<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { QRMethod } from '@/utils/constants';
const { t } = useI18n();
import { useClipboard } from '@vueuse/core';
import { dynamicLS } from '@/utils/storageKeys';
import PinPrompt from '@/components/PinPrompt.vue';
import QRPrintCard from '@/components/QRPrintCard.vue';

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
const toast = useToast();
const qrPrintDialog = ref(false);
const qrImage = ref<string | null>(null);

const publicUrl = computed(() => {
    // Attempt to get namespace from current router
    let ns = '';
    try {
        const route = useRoute();
        ns = route.params.namespace as string || '';
    } catch {}
    // Fallback if not found
    if (!ns) ns = 'ns';
    return `${window.location.origin}/shared/${ns}/atrace/post/${props.post.id}`;
});

async function handleCopy() {
    await copy(publicUrl.value);
    toast.add({
        title: t('app.notification'),
        description: t('app.linkCopied'),
        color: 'primary',
        timeout: 1500
    });
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

    // Always open modal for PIN entry
    showPrintPinPrompt.value = true;
    pendingPrint.value = { ns, postId: props.post.id };
}

    const showPrintPinPrompt = ref(false);
    const pendingPrint = ref<{ ns: string; postId: string } | null>(null);
    const showQRPrintCard = ref(false);
    const qrPrintCardTitle = ref('');
    const qrPrintCardAddress = ref('');
    const qrPrintCardLoading = ref(false);

    async function handlePrintPinSubmit(val: string) {
        if (!pendingPrint.value) return;
        await doPrintWithPin(val, pendingPrint.value.ns);
        showPrintPinPrompt.value = false;
        pendingPrint.value = null;
    }

    function closePrintCard() {
        showQRPrintCard.value = false;
        qrImage.value = null;
        qrPrintCardLoading.value = false;
    }

    function openPrintDialog() {
        if (qrImage.value) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                const title = qrPrintCardTitle.value || props.post.title || '';
                const address = qrPrintCardAddress.value || '';
                const imgSrc = qrImage.value;
                const postId = props.post.id || '';
                const html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>QR Code</title>
                        <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                min-height: 100vh;
                                background: #f5f5f5;
                                padding: 20px;
                            }
                            .container {
                                background: white;
                                padding: 40px;
                                border-radius: 12px;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                                text-align: center;
                                max-width: 400px;
                            }
                            .title {
                                font-size: 24px;
                                font-weight: 600;
                                margin-bottom: 12px;
                                color: #1a1a1a;
                                word-wrap: break-word;
                            }
                            .address {
                                font-size: 14px;
                                color: #666;
                                margin-bottom: 28px;
                                word-wrap: break-word;
                                min-height: 24px;
                            }
                            .qr-wrapper {
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 20px 0;
                            }
                            .qr-image {
                                width: 280px;
                                height: 280px;
                                object-fit: contain;
                            }
                            .post-id {
                                margin-top: 20px;
                                font-size: 12px;
                                color: #666;
                                font-family: monospace;
                            }
                            @media print {
                                body {
                                    background: white;
                                    padding: 0;
                                }
                                .container {
                                    box-shadow: none;
                                    padding: 30px;
                                    border-radius: 0;
                                    max-width: 100%;
                                }
                                .qr-image {
                                    width: 200px;
                                    height: 200px;
                                }
                                .post-id {
                                    font-size: 14pt;
                                    font-weight: normal;
                                    color: #000;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="title">${title}</div>
                            <div class="address">${address}</div>
                            <div class="qr-wrapper">
                                <img src='${imgSrc}' alt='QR Code' class='qr-image' />
                            </div>
                            <div class="post-id">ID: ${postId}</div>
                        </div>
                    </body>
                    </html>
                `;
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    setTimeout(() => {
                      printWindow.close();
                    }, 500);
                }, 100);
            }
        }
    }

    async function doPrintWithPin(pin: string, ns: string) {
        const { qrGenPublic } = await import('@/api/atrace/record/qrgen');
        const CryptoJS = (await import('crypto-js')).default;
        const secret = CryptoJS.MD5(pin).toString();

        qrPrintCardLoading.value = true;
        const res = await qrGenPublic(props.post.id, QRMethod.QR_STATIC, secret, ns);
        
        // If res.qr is a base64 PNG string, explicitly add data:image/png;base64, prefix
        const imgSrc = res?.qr && !res.qr.startsWith('data:') ? `data:image/png;base64,${res.qr}` : res?.qr || null;
        
        qrImage.value = imgSrc;
        qrPrintCardTitle.value = res?.postTitle || props.post.title || '';
        qrPrintCardAddress.value = res?.postFullAddress || '';
        qrPrintCardLoading.value = false;
        
        showQRPrintCard.value = true;
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
        :class="selected ? 'bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-400 dark:to-blue-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-md hover:shadow-sm'"
        class="p-4 rounded-xl w-60 max-w-[90vw] sm:max-w-xs cursor-pointer flex-shrink-0 min-h-[100px] self-stretch flex flex-col relative transition-shadow duration-200">
        <div class="flex items-center gap-2 mb-2">
            <h3 class="text-lg font-semibold truncate min-w-0 flex-1" :title="post.title">{{ post.title }}</h3>
                                <div class="flex-none flex gap-1 items-center">
                                                    <UDropdown :items="dropdownItems" :popper="{ placement: 'bottom-end', modifiers: [{ name: 'hide', enabled: false }] }" :ui="{ menu: { popper: { base: 'z-[9999]' } } }" :class="!post.id ? 'invisible pointer-events-none' : ''">
                                                        <UButton icon="i-lucide-qr-code" size="xs" color="primary" :variant="selected ? 'solid' : 'ghost'" aria-label="QR actions" />
                                                    </UDropdown>
                                        <UButton @click="onEdit" icon="i-lucide-pencil" size="xs" color="primary" :variant="selected ? 'solid' : 'ghost'" :class="!post.id ? 'invisible pointer-events-none' : ''" />
                                        <UButton v-if="canDelete" @click="onDelete" icon="i-lucide-trash-2" size="xs" color="red" :variant="selected ? 'solid' : 'ghost'" :class="!post.id ? 'invisible pointer-events-none' : ''" />
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
<QRPrintCard
    v-if="showQRPrintCard"
    :title="qrPrintCardTitle"
    :address="qrPrintCardAddress"
    :qr-image="qrImage"
    :loading="qrPrintCardLoading"
    :post-id="props.post.id"
    @close="closePrintCard"
    @print="openPrintDialog"
/>
</template>