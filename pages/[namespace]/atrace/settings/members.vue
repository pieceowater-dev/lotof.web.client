<template>
  <div class="members-settings">
    <div class="header">
      <h1>{{ $t('atrace.members.title') }}</h1>
      <p class="subtitle">{{ $t('atrace.members.subtitle') }}</p>
    </div>

    <!-- Plan Limits Info -->
    <div v-if="planLimits" class="limits-info card">
      <div class="info-item">
        <span class="label">{{ $t('atrace.members.activeCount') }}</span>
        <span class="value">{{ activeMembersCount }} / {{ planLimits.max_employees || 'unlimited' }}</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <p>{{ $t('common.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error card">
      <p>{{ error }}</p>
    </div>

    <!-- Members List -->
    <div v-else class="members-list card">
      <div v-if="members.length === 0" class="empty-state">
        <p>{{ $t('atrace.members.noMembers') }}</p>
      </div>

      <div v-else class="members-table">
        <div class="table-header">
          <div class="col-user">{{ $t('atrace.members.user') }}</div>
          <div class="col-status">{{ $t('atrace.members.status') }}</div>
          <div class="col-actions">{{ $t('common.actions') }}</div>
        </div>

        <div v-for="member in members" :key="member.id" class="table-row">
          <div class="col-user">
            <div class="user-info">
              <span class="user-name">{{ member.userId }}</span>
              <span class="user-joined">{{ formatDate(member.createdAt) }}</span>
            </div>
          </div>

          <div class="col-status">
            <span v-if="member.isActive" class="status-badge active">
              {{ $t('atrace.members.active') }}
            </span>
            <span v-else class="status-badge inactive">
              {{ $t('atrace.members.inactive') }}
            </span>
          </div>

          <div class="col-actions">
            <button
              v-if="isOwner"
              class="toggle-btn"
              :class="{ active: member.isActive }"
              :disabled="toggling.has(member.id) || !canToggle(member)"
              @click="toggleMemberStatus(member)"
            >
              <span v-if="toggling.has(member.id)">...</span>
              <span v-else>
                {{ member.isActive ? $t('atrace.members.deactivate') : $t('atrace.members.activate') }}
              </span>
            </button>
            <span v-else-if="!member.isActive" class="text-muted">
              {{ $t('atrace.members.ownerOnly') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Warning Message -->
    <div v-if="isOwner && activeMembersCount >= (planLimits?.max_employees || Infinity)" class="warning card">
      <p>{{ $t('atrace.members.limitReached') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getActiveMembersCount, setMemberActive } from '~/api/atrace/members/setActive'
import type { Member, PlanLimits } from '~/types/atrace'

const { t } = useI18n()
const route = useRoute()

const namespace = computed(() => route.params.namespace as string)
const members = ref<Member[]>([])
const activeMembersCount = ref(0)
const planLimits = ref<PlanLimits | null>(null)
const loading = ref(false)
const error = ref('')
const toggling = ref(new Set<string>())

const isOwner = ref(true) // Should be fetched from backend

// Get all members and limits
onMounted(async () => {
  loading.value = true
  error.value = ''

  try {
    // Fetch plan limits
    const limitsResponse = await $fetch('/api/atrace/plans/limits', {
      method: 'GET',
    })
    planLimits.value = limitsResponse as PlanLimits

    // Fetch active members count
    const token = useCookie('auth_token').value
    activeMembersCount.value = await getActiveMembersCount(token || undefined)

    // Fetch members list
    const membersResponse = await $fetch('/api/atrace/members', {
      method: 'GET',
    })
    members.value = membersResponse as Member[]
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load members'
    console.error('Error loading members:', err)
  } finally {
    loading.value = false
  }
})

// Toggle member status
async function toggleMemberStatus(member: Member) {
  if (!isOwner.value) return

  // Check if activating would exceed limit
  if (!member.isActive && activeMembersCount.value >= (planLimits.value?.max_employees || Infinity)) {
    error.value = `Cannot activate more members. Limit is ${planLimits.value?.max_employees}`
    return
  }

  try {
    toggling.value.add(member.id)
    const token = useCookie('auth_token').value

    await setMemberActive(namespace.value, {
      userId: member.userId,
      isActive: !member.isActive,
    }, token || undefined)

    // Update local state
    const memberIndex = members.value.findIndex(m => m.id === member.id)
    if (memberIndex !== -1) {
      members.value[memberIndex].isActive = !members.value[memberIndex].isActive
    }

    // Update active count
    if (!member.isActive) {
      activeMembersCount.value++
    } else {
      activeMembersCount.value--
    }

    error.value = ''
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update member status'
    // Check if error message is a localization key (e.g., "common.namespaceMissing")
    if (errorMessage.includes('.')) {
      // Try to translate using i18n
      const translated = t(errorMessage)
      // If translation exists (not the key itself), use it, otherwise use the raw message
      error.value = translated !== errorMessage ? translated : errorMessage
    } else {
      error.value = errorMessage
    }
    console.error('Error updating member:', err)
  } finally {
    toggling.value.delete(member.id)
  }
}

// Check if member can be toggled
function canToggle(member: Member): boolean {
  if (!isOwner.value) return false
  if (member.isActive) return true // Can always deactivate
  // Can activate if not at limit
  return activeMembersCount.value < (planLimits.value?.max_employees || Infinity)
}

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<style scoped>
.members-settings {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

.subtitle {
  color: #6b7280;
  margin: 0;
}

.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.limits-info {
  background: #f3f4f6;
  border-left: 4px solid #3b82f6;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  font-weight: 500;
  color: #374151;
}

.value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

.loading,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.error {
  background: #fee2e2;
  border-left: 4px solid #ef4444;
  color: #991b1b;
}

.warning {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  color: #92400e;
}

.members-table {
  display: flex;
  flex-direction: column;
}

.table-header {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid #f3f4f6;
  align-items: center;
}

.table-row:last-child {
  border-bottom: none;
}

.col-user {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 500;
  color: #1f2937;
}

.user-joined {
  font-size: 0.875rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.col-status,
.col-actions {
  text-align: right;
}

.status-badge {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge.active {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.toggle-btn.active {
  background: #ef4444;
  color: white;
  border-color: #dc2626;
}

.toggle-btn.active:hover:not(:disabled) {
  background: #dc2626;
}

.toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.text-muted {
  color: #9ca3af;
  font-size: 0.875rem;
}
</style>
