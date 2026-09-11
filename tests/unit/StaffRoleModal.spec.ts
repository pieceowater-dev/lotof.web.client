// StaffRoleModal is the shared body behind 3 products' staff-role modals
// (FRONTEND_AUDIT.md C3, 47b0b66) -- a regression here breaks role
// assignment for menu/tasks/goods at once, so it's a natural next M1-step-2
// candidate (@vue/test-utils on key components).
//
// @nuxt/ui components (UModal/UCard/UFormGroup/USelectMenu/UButton) aren't
// registered in this plain-Vitest environment (no Nuxt runtime), so they're
// stubbed with minimal functional equivalents -- a real <select>/<button>
// wired to the same v-model/@click contract the real components expose, not
// just an inert placeholder. That keeps the test exercising this
// component's own logic (role defaulting, submit payload, description
// lookup) through real user-facing interactions rather than reaching into
// internals script-setup doesn't expose on the instance anyway.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StaffRoleModal, { type StaffRoleOption } from '@/components/StaffRoleModal.vue';

const roleOptions: StaffRoleOption[] = [
  { label: 'No role', value: 'NONE' },
  { label: 'Manager', value: 'MANAGER' },
  { label: 'Cashier', value: 'CASHIER' },
];
const roleDescriptions = { MANAGER: 'Full access', CASHIER: 'POS only' };

const stubs = {
  UModal: { template: '<div><slot /></div>' },
  UCard: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
  UFormGroup: { template: '<div><slot /></div>' },
  USelectMenu: {
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    template: `
      <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    `,
  },
  UButton: {
    props: ['label', 'disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
  },
};

function makeWrapper(propsOverride: Partial<InstanceType<typeof StaffRoleModal>['$props']> = {}) {
  return mount(StaffRoleModal, {
    props: {
      modelValue: true,
      member: { userId: 'u1', username: 'alice', email: 'alice@example.com' },
      currentRole: null,
      saving: false,
      roleOptions,
      roleDescriptions,
      title: 'Change role',
      roleLabel: 'Role',
      cancelLabel: 'Cancel',
      saveLabel: 'Save',
      loadingLabel: 'Saving…',
      ...propsOverride,
    },
    global: { stubs },
  });
}

describe('StaffRoleModal', () => {
  it('defaults the select to NONE when the member has no current role', () => {
    const wrapper = makeWrapper({ currentRole: null });
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('NONE');
  });

  it('defaults the select to the member\'s current role', () => {
    const wrapper = makeWrapper({ currentRole: 'MANAGER' });
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('MANAGER');
  });

  it('shows the member\'s display name and email in the header', () => {
    const wrapper = makeWrapper();
    expect(wrapper.text()).toContain('alice');
    expect(wrapper.text()).toContain('alice@example.com');
  });

  it('shows the description for the selected role, and nothing for "no role"', async () => {
    const wrapper = makeWrapper({ currentRole: null });
    expect(wrapper.text()).not.toContain('Full access');
    expect(wrapper.text()).not.toContain('POS only');

    await wrapper.find('select').setValue('MANAGER');
    expect(wrapper.text()).toContain('Full access');

    await wrapper.find('select').setValue('CASHIER');
    expect(wrapper.text()).toContain('POS only');
    expect(wrapper.text()).not.toContain('Full access');
  });

  it('emits submit with role:null when NONE is selected (revokes access, not a literal "NONE" role)', async () => {
    const wrapper = makeWrapper({ currentRole: 'MANAGER' });
    await wrapper.find('select').setValue('NONE');
    await wrapper.find('button:last-of-type').trigger('click');

    expect(wrapper.emitted('submit')).toEqual([[{ userId: 'u1', role: null }]]);
  });

  it('emits submit with the selected role code otherwise', async () => {
    const wrapper = makeWrapper({ currentRole: null });
    await wrapper.find('select').setValue('CASHIER');
    await wrapper.find('button:last-of-type').trigger('click');

    expect(wrapper.emitted('submit')).toEqual([[{ userId: 'u1', role: 'CASHIER' }]]);
  });

  it('does not submit when there is no member (defensive guard)', async () => {
    const wrapper = makeWrapper({ member: null });
    await wrapper.find('button:last-of-type').trigger('click');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('shows saving/loading label and disables submit while saving', () => {
    const wrapper = makeWrapper({ saving: true });
    const submitBtn = wrapper.find('button:last-of-type');
    expect(submitBtn.text()).toBe('Saving…');
    expect((submitBtn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('closing (v-model false via UModal) emits update:modelValue false', async () => {
    // UModal is stubbed to a plain wrapper div with no v-model plumbing of
    // its own, so this exercises handleClose() via the Cancel button
    // instead -- the same code path UModal's @close calls in the real app.
    const wrapper = makeWrapper();
    await wrapper.find('button:first-of-type').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });
});
