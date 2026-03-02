import type { Meta, StoryObj } from '@storybook/vue3'
import StatusBadge from './StatusBadge.vue'

const meta: Meta<typeof StatusBadge> = {
  title: 'Components/StatusBadge',
  component: StatusBadge,
  args: {
    status: 'active'
  }
}

export default meta
type Story = StoryObj<typeof StatusBadge>

export const Active: Story = { args: { status: 'active' } }
export const Pending: Story = { args: { status: 'pending' } }
export const Failed: Story = { args: { status: 'failed' } }
