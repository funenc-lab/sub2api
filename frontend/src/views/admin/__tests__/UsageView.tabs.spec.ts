import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import UsageView from '../UsageView.vue'

const { usageList, usageStats, getSnapshotV2, getModelStats, routeState, routerReplace } = vi.hoisted(() => ({
  usageList: vi.fn(),
  usageStats: vi.fn(),
  getSnapshotV2: vi.fn(),
  getModelStats: vi.fn(),
  routeState: require('vue').reactive({ query: {} as Record<string, string> }),
  routerReplace: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    usage: {
      list: usageList,
      getStats: usageStats
    },
    dashboard: {
      getSnapshotV2,
      getModelStats
    },
    users: {
      getById: vi.fn()
    }
  }
}))

vi.mock('@/api/admin/usage', () => ({
  adminUsageAPI: {
    list: usageList
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn()
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    replace: routerReplace
  })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

const mountPage = () => mount(UsageView, {
  global: {
    stubs: {
      AppLayout: { template: '<div><slot /></div>' },
      UsageStatsCards: { template: '<div data-test="records-stats-cards" />' },
      DateRangePicker: true,
      Select: true,
      ModelDistributionChart: true,
      GroupDistributionChart: true,
      EndpointDistributionChart: true,
      TokenUsageTrend: true,
      UsageFilters: true,
      UsageTable: { template: '<div data-test="records-table" />' },
      Pagination: true,
      UsageExportProgress: true,
      UsageCleanupDialog: true,
      UserBalanceHistoryModal: true,
      UserUsageSummaryTab: {
        props: ['startDate', 'endDate'],
        template: '<div data-test="user-summary-tab" :data-start-date="startDate" :data-end-date="endDate" />'
      },
      Icon: true
    }
  }
})

describe('admin UsageView tabs', () => {
  beforeEach(() => {
    routeState.query = {}
    routerReplace.mockReset()
    usageList.mockReset()
    usageStats.mockReset()
    getSnapshotV2.mockReset()
    getModelStats.mockReset()
    usageList.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 })
    usageStats.mockResolvedValue({})
    getSnapshotV2.mockResolvedValue({ trend: [], groups: [] })
    getModelStats.mockResolvedValue({ models: [] })
  })

  it('defaults to the records tab', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-test="records-table"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="records-stats-cards"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="user-summary-tab"]').exists()).toBe(false)
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="tab-records"]').attributes('role')).toBe('tab')
    expect(wrapper.find('[data-test="tab-records"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.find('[data-test="tab-user-summary"]').attributes('role')).toBe('tab')
    expect(wrapper.find('[data-test="tab-user-summary"]').attributes('aria-selected')).toBe('false')
  })

  it('renders user summary tab when tab query is user-summary', async () => {
    routeState.query = {
      tab: 'user-summary',
      start_date: '2026-05-01',
      end_date: '2026-05-11'
    }

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-test="records-table"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="records-stats-cards"]').exists()).toBe(false)
    const summaryTab = wrapper.find('[data-test="user-summary-tab"]')
    expect(summaryTab.exists()).toBe(true)
    expect(summaryTab.attributes('data-start-date')).toBe('2026-05-01')
    expect(summaryTab.attributes('data-end-date')).toBe('2026-05-11')
  })

  it('switches tabs through the tab buttons', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-test="tab-user-summary"]').trigger('click')

    expect(routerReplace).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.objectContaining({ tab: 'user-summary' })
    }))
  })

  it('syncs active tab when route query changes after mount', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-test="records-table"]').exists()).toBe(true)

    routeState.query = { tab: 'user-summary' }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="records-table"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="user-summary-tab"]').exists()).toBe(true)
  })

  it('applies records query filters and reloads after same-component navigation', async () => {
    routeState.query = { tab: 'user-summary' }
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-test="user-summary-tab"]').exists()).toBe(true)
    usageList.mockClear()
    usageStats.mockClear()
    getSnapshotV2.mockClear()
    getModelStats.mockClear()

    routeState.query = {
      tab: 'records',
      user_id: '42',
      start_date: '2026-05-01',
      end_date: '2026-05-11'
    }
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(wrapper.find('[data-test="records-table"]').exists()).toBe(true)
    expect(usageList).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      start_date: '2026-05-01',
      end_date: '2026-05-11'
    }), expect.anything())
    expect(usageStats).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      start_date: '2026-05-01',
      end_date: '2026-05-11'
    }))
    expect(getSnapshotV2).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      start_date: '2026-05-01',
      end_date: '2026-05-11'
    }))
    expect(getModelStats).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      start_date: '2026-05-01',
      end_date: '2026-05-11'
    }))
  })
})
