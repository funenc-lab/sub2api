import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import UserUsageSummaryTab from '../UserUsageSummaryTab.vue'

const { getUserBreakdown, routerPush, showError, saveAsMock, writeMock, aoaToSheetMock } = vi.hoisted(() => ({
  getUserBreakdown: vi.fn(),
  routerPush: vi.fn(),
  showError: vi.fn(),
  saveAsMock: vi.fn(),
  writeMock: vi.fn(() => new ArrayBuffer(8)),
  aoaToSheetMock: vi.fn((rows: unknown[][]) => ({ rows }))
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    dashboard: {
      getUserBreakdown
    }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush
  })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        if (params?.id != null) return `${key} ${params.id}`
        return key
      }
    })
  }
})

vi.mock('vue-chartjs', () => ({
  Doughnut: {
    props: ['data', 'options'],
    template: '<div class="doughnut">{{ JSON.stringify({ data, options }) }}</div>'
  },
  Bar: {
    props: ['data', 'options'],
    template: '<div class="bar">{{ JSON.stringify({ data, options }) }}</div>'
  }
}))

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    aoa_to_sheet: aoaToSheetMock,
    book_append_sheet: vi.fn()
  },
  write: writeMock
}))

vi.mock('file-saver', () => ({
  saveAs: saveAsMock
}))

const rows = [
  {
    user_id: 1,
    email: 'alpha@example.com',
    requests: 10,
    total_tokens: 2_000_000,
    cost: 3,
    actual_cost: 2,
    account_cost: 1.25
  },
  {
    user_id: 2,
    email: 'beta@example.com',
    requests: 5,
    total_tokens: 500_000,
    cost: 1,
    actual_cost: 0.5,
    account_cost: 0.75
  }
]

const mountTab = () => mount(UserUsageSummaryTab, {
  props: {
    startDate: '2026-05-01',
    endDate: '2026-05-11'
  },
  global: {
    stubs: {
      LoadingSpinner: true,
      Icon: true,
      Select: true,
      DateRangePicker: {
        props: ['startDate', 'endDate'],
        emits: ['update:startDate', 'update:endDate', 'change'],
        template: `
          <button
            data-test="summary-date-range"
            @click="$emit('update:startDate', '2026-05-03'); $emit('update:endDate', '2026-05-10'); $emit('change', { startDate: '2026-05-03', endDate: '2026-05-10', preset: null })"
          >
            {{ startDate }} - {{ endDate }}
          </button>
        `
      },
      Pagination: {
        props: ['page', 'total', 'pageSize'],
        emits: ['update:page', 'update:pageSize'],
        template: `
          <div data-test="summary-pagination">
            <button data-test="summary-next-page" @click="$emit('update:page', 2)">next</button>
            <button data-test="summary-page-size" @click="$emit('update:pageSize', 50)">size</button>
          </div>
        `
      }
    }
  }
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('UserUsageSummaryTab', () => {
  beforeEach(() => {
    getUserBreakdown.mockReset()
    routerPush.mockReset()
    showError.mockReset()
    saveAsMock.mockReset()
    writeMock.mockClear()
    aoaToSheetMock.mockClear()
    getUserBreakdown.mockResolvedValue({
      users: rows,
      start_date: '2026-05-01',
      end_date: '2026-05-11'
    })
  })

  it('loads user breakdown with props dates and default limit', async () => {
    mountTab()
    await flushPromises()

    expect(getUserBreakdown).toHaveBeenCalledWith({
      start_date: '2026-05-01',
      end_date: '2026-05-11',
      limit: 200
    })
  })

  it('renders derived summaries and chart inputs', async () => {
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.text()).toContain('alpha@example.com')
    expect(wrapper.text()).toContain('beta@example.com')
    expect(wrapper.text()).toContain('$2.5000')
    expect(wrapper.text()).toContain('$2.0000')
    expect(wrapper.text()).toContain('$0.7500')
    expect(wrapper.text()).toContain('80.0%')
    expect(wrapper.find('[data-test="export-users"]').text()).toContain('usage.exportExcel')
    const chartText = wrapper.findAll('.bar, .doughnut').map((node) => node.text()).join('\n')
    expect(chartText).toContain('alpha@example.com')
    expect(chartText).toContain('"usage.totalTokens (M)"')
    expect(chartText).toContain('"data":[2,0.5]')
    expect(chartText).toContain('"unit":"requests"')
    expect(chartText).toContain('"unit":"USD"')
    expect(wrapper.text()).not.toContain('admin.usage.userSummary.efficiency')
  })

  it('renders chart cards with summary metrics and refined chart options', async () => {
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.find('[data-test="chart-card-cost-distribution"]').text()).toContain('$2.5000')
    expect(wrapper.find('[data-test="chart-card-request-distribution"]').text()).toContain('15')
    expect(wrapper.find('[data-test="chart-card-token-distribution"]').text()).toContain('2.50M')
    expect(wrapper.find('[data-test="chart-card-cost-comparison"]').text()).toContain('$2.5000')
    expect(wrapper.find('[data-test="chart-card-request-distribution"] .h-56').exists()).toBe(true)
    expect(wrapper.find('[data-test="chart-card-cost-distribution"] .max-h-60').exists()).toBe(true)

    const chartText = wrapper.findAll('.bar, .doughnut').map((node) => node.text()).join('\n')
    expect(chartText).toContain('"display":false')
    expect(chartText).toContain('"borderRadius":6')
    expect(chartText).toContain('"cutout":"68%"')
    expect(chartText).toContain('"backgroundColor":"#0f766e"')
    expect(chartText).not.toContain('"usage.standardCost (USD)"')
    expect(chartText).not.toContain('"usage.accountCost (USD)"')
  })

  it('sorts each bar chart by its own metric', async () => {
    getUserBreakdown.mockResolvedValueOnce({
      users: [
        {
          user_id: 1,
          email: 'cost-leader@example.com',
          requests: 3,
          total_tokens: 300_000,
          cost: 8,
          actual_cost: 8,
          account_cost: 1
        },
        {
          user_id: 2,
          email: 'request-leader@example.com',
          requests: 90,
          total_tokens: 500_000,
          cost: 2,
          actual_cost: 2,
          account_cost: 1
        },
        {
          user_id: 3,
          email: 'token-leader@example.com',
          requests: 7,
          total_tokens: 4_000_000,
          cost: 3,
          actual_cost: 3,
          account_cost: 1
        }
      ]
    })

    const wrapper = mountTab()
    await flushPromises()

    const requestChart = JSON.parse(wrapper.find('[data-test="chart-card-request-distribution"] .bar').text())
    const tokenChart = JSON.parse(wrapper.find('[data-test="chart-card-token-distribution"] .bar').text())
    const costChart = JSON.parse(wrapper.find('[data-test="chart-card-cost-comparison"] .bar').text())

    expect(requestChart.data.labels).toEqual([
      'request-leader@example.com',
      'token-leader@example.com',
      'cost-leader@example.com'
    ])
    expect(requestChart.data.datasets[0].data).toEqual([90, 7, 3])

    expect(tokenChart.data.labels).toEqual([
      'token-leader@example.com',
      'request-leader@example.com',
      'cost-leader@example.com'
    ])
    expect(tokenChart.data.datasets[0].data).toEqual([4, 0.5, 0.3])

    expect(costChart.data.labels).toEqual([
      'cost-leader@example.com',
      'token-leader@example.com',
      'request-leader@example.com'
    ])
    expect(costChart.data.datasets[0].data).toEqual([8, 3, 2])
  })

  it('groups long-tail users into other users in cost distribution', async () => {
    getUserBreakdown.mockResolvedValueOnce({
      users: Array.from({ length: 10 }, (_, index) => ({
        user_id: index + 1,
        email: `spender${index + 1}@example.com`,
        requests: 1,
        total_tokens: 1000,
        cost: 10 - index,
        actual_cost: 10 - index,
        account_cost: 1
      }))
    })

    const wrapper = mountTab()
    await flushPromises()

    const costChartText = wrapper.find('.doughnut').text()
    expect(costChartText).toContain('spender1@example.com')
    expect(costChartText).toContain('admin.usage.userSummary.otherUsers')
    expect(costChartText).toContain('"data":[10,9,8,7,6,5,4,3,3]')
    expect(wrapper.find('[data-test="cost-distribution-rank-other"]').text()).toContain('$3.0000')
    expect(wrapper.find('[data-test="cost-distribution-rank-other"]').text()).toContain('5.5%')
  })

  it('updates date range filters and keeps route query in sync', async () => {
    const wrapper = mountTab()
    await flushPromises()

    await wrapper.find('[data-test="summary-date-range"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({
      path: '/admin/usage',
      query: {
        tab: 'user-summary',
        start_date: '2026-05-03',
        end_date: '2026-05-10'
      }
    })
    expect(getUserBreakdown).toHaveBeenLastCalledWith({
      start_date: '2026-05-03',
      end_date: '2026-05-10',
      limit: 200
    })
  })

  it('paginates user usage detail rows on the client', async () => {
    getUserBreakdown.mockResolvedValueOnce({
      users: Array.from({ length: 25 }, (_, index) => ({
        user_id: index + 1,
        email: `user${index + 1}@example.com`,
        requests: 25 - index,
        total_tokens: 1000,
        cost: 1,
        actual_cost: 1,
        account_cost: 0.5
      }))
    })

    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.find('[data-test="summary-pagination"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('user1@example.com')
    expect(wrapper.text()).not.toContain('user21@example.com')

    await wrapper.find('[data-test="summary-next-page"]').trigger('click')

    expect(wrapper.find('[data-test="user-row-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="user-row-21"]').exists()).toBe(true)
  })

  it('navigates to records tab when a user row is clicked', async () => {
    const wrapper = mountTab()
    await flushPromises()

    await wrapper.find('[data-test="user-row-1"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith({
      path: '/admin/usage',
      query: {
        tab: 'records',
        user_id: '1',
        start_date: '2026-05-01',
        end_date: '2026-05-11'
      }
    })
  })

  it('supports keyboard navigation on user rows', async () => {
    const wrapper = mountTab()
    await flushPromises()

    const row = wrapper.find('[data-test="user-row-1"]')
    expect(row.attributes('role')).toBe('button')
    expect(row.attributes('tabindex')).toBe('0')

    await row.trigger('keydown', { key: 'Enter' })

    expect(routerPush).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.objectContaining({ user_id: '1' })
    }))
  })

  it('exports the current aggregate rows to Excel', async () => {
    const wrapper = mountTab()
    await flushPromises()

    await wrapper.find('[data-test="export-users"]').trigger('click')
    await flushPromises()

    expect(writeMock).toHaveBeenCalledWith(expect.anything(), { bookType: 'xlsx', type: 'array' })
    expect(aoaToSheetMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.arrayContaining(['usage.totalTokens (M)']),
      expect.arrayContaining(['2026-05-01 - 2026-05-11', 'alpha@example.com', 1, 10, '2.00']),
      expect.arrayContaining(['2026-05-01 - 2026-05-11', 'beta@example.com', 2, 5, '0.50'])
    ]))
    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), 'user_usage_summary_2026-05-01_to_2026-05-11.xlsx')
  })

  it('renders empty state when no users are returned', async () => {
    getUserBreakdown.mockResolvedValueOnce({ users: [] })

    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.text()).toContain('admin.usage.userSummary.empty')
  })

  it('keeps newer user breakdown data when older requests resolve later', async () => {
    const first = deferred<{ users: typeof rows }>()
    const second = deferred<{ users: typeof rows }>()
    getUserBreakdown
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const wrapper = mountTab()
    await wrapper.setProps({ startDate: '2026-05-02' })

    second.resolve({
      users: [{
        user_id: 3,
        email: 'newer@example.com',
        requests: 1,
        total_tokens: 100,
        cost: 1,
        actual_cost: 1,
        account_cost: 0.5
      }]
    })
    await flushPromises()

    first.resolve({ users: rows })
    await flushPromises()

    expect(wrapper.text()).toContain('newer@example.com')
    expect(wrapper.text()).not.toContain('alpha@example.com')
  })

  it('shows an error state and retry action when loading fails', async () => {
    getUserBreakdown.mockRejectedValueOnce(new Error('network'))

    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.text()).toContain('admin.usage.userSummary.loadFailed')
    await wrapper.find('[data-test="retry-load"]').trigger('click')

    expect(getUserBreakdown).toHaveBeenCalledTimes(2)
  })
})
