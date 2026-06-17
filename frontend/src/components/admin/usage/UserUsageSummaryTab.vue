<template>
  <div data-test="user-summary-tab" class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('admin.usage.userSummary.title') }}
        </h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('admin.usage.userSummary.description') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('admin.usage.userSummary.dateRange') }}:
          </span>
          <DateRangePicker
            v-model:start-date="summaryStartDate"
            v-model:end-date="summaryEndDate"
            @change="onDateRangeChange"
          />
        </div>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="loading"
          @click="loadData"
        >
          <Icon name="refresh" size="sm" />
          <span>{{ t('common.refresh') }}</span>
        </button>
        <button
          type="button"
          data-test="export-users"
          class="btn btn-primary"
          :disabled="loading || displayRows.length === 0"
          @click="exportExcel"
        >
          <Icon name="download" size="sm" />
          <span>{{ t('usage.exportExcel') }}</span>
        </button>
      </div>
    </div>

    <div v-if="loadError" class="card p-8 text-center">
      <p class="text-sm font-medium text-red-600 dark:text-red-400">
        {{ t('admin.usage.userSummary.loadFailed') }}
      </p>
      <button
        type="button"
        data-test="retry-load"
        class="btn btn-secondary mt-4"
        @click="loadData"
      >
        <Icon name="refresh" size="sm" />
        <span>{{ t('common.retry') }}</span>
      </button>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="card flex items-center gap-3 p-4"
        >
          <div :class="['rounded-lg p-2', card.iconClass]">
            <Icon :name="card.icon" size="md" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ card.label }}</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white">{{ card.value }}</p>
          </div>
        </div>
      </div>

      <div v-if="loading" class="card p-8 text-center">
        <LoadingSpinner class="mx-auto" />
      </div>

      <div v-else-if="displayRows.length === 0" class="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('admin.usage.userSummary.empty') }}
      </div>

      <template v-else>
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section data-test="chart-card-cost-distribution" class="card p-3 sm:p-4">
            <div class="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('admin.usage.userSummary.costDistribution') }}
                </h3>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.usage.userSummary.costDistributionHint') }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('usage.actualCost') }}</p>
                <p class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                  {{ formatCurrency(totalActualCost) }}
                </p>
              </div>
            </div>
            <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,15rem)]">
              <div class="h-56 sm:h-60">
                <Doughnut :data="actualCostDistributionData" :options="doughnutOptions" />
              </div>
              <div class="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                <div
                  v-for="item in costDistributionRows"
                  :key="item.key"
                  :data-test="`cost-distribution-rank-${item.key}`"
                  class="rounded-md border border-gray-100 px-2 py-1.5 dark:border-dark-700"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-2">
                      <span
                        class="h-2.5 w-2.5 shrink-0 rounded-full"
                        :style="{ backgroundColor: item.color }"
                      ></span>
                      <span class="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                        {{ item.label }}
                      </span>
                    </div>
                    <span class="text-xs font-semibold tabular-nums text-gray-900 dark:text-white">
                      {{ formatCurrency(item.value) }}
                    </span>
                  </div>
                  <div class="mt-1 flex items-center gap-2">
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-dark-700">
                      <div
                        class="h-full rounded-full"
                        :style="{ width: `${item.share}%`, backgroundColor: item.color }"
                      ></div>
                    </div>
                    <span class="w-10 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {{ formatPercent(item.share) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section data-test="chart-card-request-distribution" class="card p-3 sm:p-4">
            <div class="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('admin.usage.userSummary.requestDistribution') }}
                </h3>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.usage.userSummary.topUsersHint') }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('usage.totalRequests') }}</p>
                <p class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                  {{ totalRequests.toLocaleString() }}
                </p>
              </div>
            </div>
            <div class="h-56 sm:h-60">
              <Bar :data="requestDistributionData" :options="barOptions" />
            </div>
          </section>

          <section data-test="chart-card-token-distribution" class="card p-3 sm:p-4">
            <div class="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('admin.usage.userSummary.tokenDistribution') }}
                </h3>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.usage.userSummary.tokenDistributionHint') }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('usage.totalTokens') }}</p>
                <p class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                  {{ formatMetric(totalTokens) }}
                </p>
              </div>
            </div>
            <div class="h-56 sm:h-60">
              <Bar :data="tokenDistributionData" :options="barOptions" />
            </div>
          </section>

          <section data-test="chart-card-cost-comparison" class="card p-3 sm:p-4">
            <div class="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('admin.usage.userSummary.costComparison') }}
                </h3>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('admin.usage.userSummary.costComparisonHint') }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('usage.actualCost') }}</p>
                <p class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                  {{ formatCurrency(totalActualCost) }}
                </p>
              </div>
            </div>
            <div class="h-56 sm:h-60">
              <Bar :data="costComparisonData" :options="barOptions" />
            </div>
          </section>

        </div>

        <section class="card overflow-hidden">
          <div class="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 dark:border-dark-700 sm:flex-row sm:items-center sm:justify-between">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('admin.usage.userSummary.tableTitle') }}
            </h3>
            <div class="flex items-center gap-2">
              <span id="user-summary-limit-label" class="text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ t('admin.usage.userSummary.limitLabel') }}
              </span>
              <Select
                aria-labelledby="user-summary-limit-label"
                v-model="limit"
                :options="limitOptions"
                class="w-24"
              />
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-100 text-sm dark:divide-dark-700">
              <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-dark-800 dark:text-gray-400">
                <tr>
                  <th class="px-4 py-3 text-left">{{ t('admin.usage.user') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('usage.totalRequests') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('usage.totalTokens') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('usage.actualCost') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('usage.standardCost') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('usage.accountCost') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('admin.usage.userSummary.margin') }}</th>
                  <th class="px-4 py-3 text-right">{{ t('admin.usage.userSummary.share') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-dark-700">
                <tr
                  v-for="row in pagedRows"
                  :key="row.user_id"
                  :data-test="`user-row-${row.user_id}`"
                  tabindex="0"
                  role="button"
                  class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-dark-800"
                  @click="goToUserRecords(row)"
                  @keydown.enter.prevent="goToUserRecords(row)"
                  @keydown.space.prevent="goToUserRecords(row)"
                >
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-900 dark:text-white">{{ row.email || '-' }}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">#{{ row.user_id }}</div>
                  </td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ row.requests.toLocaleString() }}</td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ row.total_tokens.toLocaleString() }}</td>
                  <td class="px-4 py-3 text-right font-medium text-green-600 tabular-nums dark:text-green-400">
                    {{ formatCurrency(row.actual_cost) }}
                  </td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(row.cost) }}</td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(row.account_cost) }}</td>
                  <td
                    class="px-4 py-3 text-right tabular-nums"
                    :class="row.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                  >
                    {{ formatCurrency(row.margin) }}
                  </td>
                  <td class="px-4 py-3 text-right tabular-nums">{{ formatPercent(row.share) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pagination
            v-if="displayRows.length > pageSize"
            :page="page"
            :total="displayRows.length"
            :page-size="pageSize"
            :page-size-options="[20, 50, 100]"
            @update:page="handlePageChange"
            @update:pageSize="handlePageSizeChange"
          />
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js'
import type { ChartOptions, TooltipItem } from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'
import { saveAs } from 'file-saver'

import { adminAPI } from '@/api/admin'
import Select, { type SelectOption } from '@/components/common/Select.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import Icon from '@/components/icons/Icon.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Pagination from '@/components/common/Pagination.vue'
import { useAppStore } from '@/stores/app'
import type { UserBreakdownItem } from '@/types'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps<{
  startDate: string
  endDate: string
}>()

interface DisplayRow extends UserBreakdownItem {
  margin: number
  share: number
  cost_per_1k_tokens: number
  tokens_per_request: number
}

type SummaryIcon = 'users' | 'document' | 'cube' | 'dollar' | 'server'
interface SummaryCard {
  label: string
  value: string
  icon: SummaryIcon
  iconClass: string
}

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const limit = ref(200)
const page = ref(1)
const pageSize = ref(20)
const summaryStartDate = ref(props.startDate)
const summaryEndDate = ref(props.endDate)
const loading = ref(false)
const loadError = ref(false)
const users = ref<UserBreakdownItem[]>([])
let loadReqSeq = 0

const limitOptions: SelectOption[] = [
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' }
]

const safeNumber = (value: number | null | undefined) => Number(value || 0)

const totalRequests = computed(() =>
  users.value.reduce((sum, row) => sum + safeNumber(row.requests), 0)
)
const totalTokens = computed(() =>
  users.value.reduce((sum, row) => sum + safeNumber(row.total_tokens), 0)
)
const totalActualCost = computed(() =>
  users.value.reduce((sum, row) => sum + safeNumber(row.actual_cost), 0)
)
const totalAccountCost = computed(() =>
  users.value.reduce((sum, row) => sum + safeNumber(row.account_cost), 0)
)

const displayRows = computed<DisplayRow[]>(() => {
  const actualTotal = totalActualCost.value
  return users.value
    .map((row) => {
      const actualCost = safeNumber(row.actual_cost)
      const tokens = safeNumber(row.total_tokens)
      const requests = safeNumber(row.requests)

      return {
        ...row,
        requests,
        total_tokens: tokens,
        cost: safeNumber(row.cost),
        actual_cost: actualCost,
        account_cost: safeNumber(row.account_cost),
        margin: actualCost - safeNumber(row.account_cost),
        share: actualTotal > 0 ? (actualCost / actualTotal) * 100 : 0,
        cost_per_1k_tokens: tokens > 0 ? (actualCost / tokens) * 1000 : 0,
        tokens_per_request: requests > 0 ? tokens / requests : 0
      }
    })
    .sort((a, b) => b.actual_cost - a.actual_cost)
})

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return displayRows.value.slice(start, start + pageSize.value)
})

const chartRowLimit = 20
const getUserLabel = (row: DisplayRow) => row.email || `#${row.user_id}`
const topRowsBy = (metric: 'requests' | 'total_tokens' | 'actual_cost') =>
  computed(() => [...displayRows.value].sort((a, b) => b[metric] - a[metric]).slice(0, chartRowLimit))

const requestChartRows = topRowsBy('requests')
const tokenChartRows = topRowsBy('total_tokens')
const costChartRows = topRowsBy('actual_cost')
const COST_DISTRIBUTION_TOP_COUNT = 8

const palette = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#4f46e5',
  '#65a30d',
  '#ea580c'
]

const costDistributionRows = computed(() => {
  const topRows = displayRows.value.slice(0, COST_DISTRIBUTION_TOP_COUNT).map((row, index) => ({
    key: String(row.user_id),
    label: row.email || `#${row.user_id}`,
    value: row.actual_cost,
    color: palette[index % palette.length],
    share: 0
  }))
  const otherRows = displayRows.value.slice(COST_DISTRIBUTION_TOP_COUNT)
  const otherTotal = otherRows.reduce((sum, row) => sum + row.actual_cost, 0)

  if (otherTotal > 0) {
    topRows.push({
      key: 'other',
      label: t('admin.usage.userSummary.otherUsers'),
      value: otherTotal,
      color: '#64748b',
      share: 0
    })
  }

  const total = topRows.reduce((sum, row) => sum + row.value, 0)
  return topRows.map((row) => ({
    ...row,
    share: total > 0 ? Number(((row.value / total) * 100).toFixed(1)) : 0
  }))
})

const actualCostDistributionData = computed(() => ({
  labels: costDistributionRows.value.map((row) => row.label),
  datasets: [
    {
      data: costDistributionRows.value.map((row) => row.value),
      backgroundColor: costDistributionRows.value.map((row) => row.color)
    }
  ]
}))

const requestDistributionData = computed(() => ({
  labels: requestChartRows.value.map(getUserLabel),
  datasets: [
    {
      label: `${t('usage.totalRequests')} (${t('admin.usage.userSummary.requestsUnit')})`,
      unit: 'requests',
      data: requestChartRows.value.map((row) => row.requests),
      backgroundColor: '#2563eb',
      borderRadius: 6,
      maxBarThickness: 18
    }
  ]
}))

const tokenDistributionData = computed(() => ({
  labels: tokenChartRows.value.map(getUserLabel),
  datasets: [
    {
      label: `${t('usage.totalTokens')} (M)`,
      unit: 'M tokens',
      data: tokenChartRows.value.map((row) => Number((row.total_tokens / 1_000_000).toFixed(2))),
      backgroundColor: '#16a34a',
      borderRadius: 6,
      maxBarThickness: 18
    }
  ]
}))

const costComparisonData = computed(() => ({
  labels: costChartRows.value.map(getUserLabel),
  datasets: [
    {
      label: `${t('usage.actualCost')} (USD)`,
      unit: 'USD',
      data: costChartRows.value.map((row) => row.actual_cost),
      backgroundColor: '#0f766e',
      borderRadius: 6,
      maxBarThickness: 14
    }
  ]
}))

const chartLabel = (value: unknown) => String(value || '')
const shortenChartLabel = (value: unknown) => {
  const label = chartLabel(value)
  return label.length > 18 ? `${label.slice(0, 16)}...` : label
}

const barOptions: ChartOptions<'bar'> = {
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        title: (items) => items[0]?.label || '',
        label: (item: TooltipItem<'bar'>) => {
          const value = typeof item.parsed.x === 'number' ? item.parsed.x : Number(item.raw || 0)
          const dataset = item.dataset as typeof item.dataset & { unit?: string }
          const unit = dataset.unit
          if (unit === 'USD') return `${item.dataset.label}: ${formatCurrency(value)}`
          if (unit === 'M tokens') return `${item.dataset.label}: ${value.toFixed(2)}M`
          return `${item.dataset.label}: ${value.toLocaleString()}`
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: {
        color: 'rgba(148, 163, 184, 0.16)'
      },
      ticks: {
        color: '#64748b',
        maxTicksLimit: 5
      }
    },
    y: {
      grid: {
        display: false
      },
      ticks: {
        color: '#64748b',
        callback: shortenChartLabel
      }
    }
  }
}

const doughnutOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (item: { label?: string; parsed: number }) =>
          `${item.label || ''}: ${formatCurrency(item.parsed)}`
      }
    }
  }
}

const formatCurrency = (value: number) => `$${safeNumber(value).toFixed(4)}`
const formatPercent = (value: number) => `${safeNumber(value).toFixed(1)}%`

const formatMetric = (value: number) => {
  const numeric = safeNumber(value)
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(2)}M`
  if (numeric >= 1_000) return `${(numeric / 1_000).toFixed(2)}K`
  return numeric.toLocaleString()
}

const summaryCards = computed<SummaryCard[]>(() => [
  {
    label: t('admin.usage.userSummary.totalUsers'),
    value: displayRows.value.length.toLocaleString(),
    icon: 'users',
    iconClass: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
  },
  {
    label: t('usage.totalRequests'),
    value: totalRequests.value.toLocaleString(),
    icon: 'document',
    iconClass: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30'
  },
  {
    label: t('usage.totalTokens'),
    value: formatMetric(totalTokens.value),
    icon: 'cube',
    iconClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'
  },
  {
    label: t('usage.actualCost'),
    value: formatCurrency(totalActualCost.value),
    icon: 'dollar',
    iconClass: 'bg-green-100 text-green-600 dark:bg-green-900/30'
  },
  {
    label: t('usage.accountCost'),
    value: formatCurrency(totalAccountCost.value),
    icon: 'server',
    iconClass: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
  }
])

const loadData = async () => {
  const seq = ++loadReqSeq
  page.value = 1
  loading.value = true
  loadError.value = false
  try {
    const response = await adminAPI.dashboard.getUserBreakdown({
      start_date: summaryStartDate.value,
      end_date: summaryEndDate.value,
      limit: Number(limit.value)
    })
    if (seq !== loadReqSeq) return
    users.value = response.users || []
  } catch {
    if (seq !== loadReqSeq) return
    users.value = []
    loadError.value = true
  } finally {
    if (seq === loadReqSeq) loading.value = false
  }
}

const goToUserRecords = (row: DisplayRow) => {
  router.push({
    path: '/admin/usage',
    query: {
      tab: 'records',
      user_id: String(row.user_id),
      start_date: summaryStartDate.value,
      end_date: summaryEndDate.value
    }
  })
}

const onDateRangeChange = (range: { startDate: string; endDate: string; preset: string | null }) => {
  summaryStartDate.value = range.startDate
  summaryEndDate.value = range.endDate
  void router.push({
    path: '/admin/usage',
    query: {
      tab: 'user-summary',
      start_date: range.startDate,
      end_date: range.endDate
    }
  })
  void loadData()
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
}

const handlePageSizeChange = (nextPageSize: number) => {
  pageSize.value = nextPageSize
  page.value = 1
}

const exportExcel = async () => {
  try {
    const XLSX = await import('xlsx')
    const headers = [
      t('admin.usage.userSummary.dateRange'),
      t('admin.usage.user'),
      'ID',
      t('usage.totalRequests'),
      `${t('usage.totalTokens')} (M)`,
      t('usage.actualCost'),
      t('usage.standardCost'),
      t('usage.accountCost'),
      t('admin.usage.userSummary.margin'),
      t('admin.usage.userSummary.share'),
      t('admin.usage.userSummary.costPer1kTokens'),
      t('admin.usage.userSummary.tokensPerRequest')
    ]

    const dateRange = `${summaryStartDate.value} - ${summaryEndDate.value}`
    const rows = displayRows.value.map((row) => [
      dateRange,
      row.email || '',
      row.user_id,
      row.requests,
      (row.total_tokens / 1_000_000).toFixed(2),
      row.actual_cost.toFixed(4),
      row.cost.toFixed(4),
      row.account_cost.toFixed(4),
      row.margin.toFixed(4),
      formatPercent(row.share),
      row.cost_per_1k_tokens.toFixed(4),
      row.tokens_per_request.toFixed(2)
    ])

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    XLSX.utils.book_append_sheet(wb, ws, 'User Summary')
    const content = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(
      new Blob([content], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      `user_usage_summary_${summaryStartDate.value}_to_${summaryEndDate.value}.xlsx`
    )
  } catch {
    appStore.showError(t('usage.exportExcelFailed'))
  }
}

watch(
  () => [props.startDate, props.endDate],
  ([nextStartDate, nextEndDate]) => {
    summaryStartDate.value = nextStartDate
    summaryEndDate.value = nextEndDate
    loadData()
  }
)

watch(
  () => limit.value,
  () => {
    loadData()
  }
)

onMounted(() => {
  loadData()
})
</script>
