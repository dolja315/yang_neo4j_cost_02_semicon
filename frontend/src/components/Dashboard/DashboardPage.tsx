import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Activity,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Package,
  Cpu,
  Factory,
  Network,
  Layers,
} from 'lucide-react'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { motion, AnimatePresence } from 'motion/react'
import { CostNetworkGraph } from './CostNetworkGraph'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { dashboardApi } from '../../services/api'

/* ═══════════ 타입 ═══════════ */
type DashboardView = 'overview' | 'process' | 'product' | 'drivers' | 'network'

interface DashboardPageProps {
  selectedView: DashboardView
}

interface SubAccountDetail {
  name: string
  amount: number
  change: number
}

interface SubAccount {
  name: string
  amount: number
  change: number
  details: string[]
  items?: SubAccountDetail[]
}

interface CostBreakdownItem {
  category: string
  amount: number
  change: number
  percent: number
  trend: number[] // 6개월 추이
  subAccounts: SubAccount[]
}

interface ProcessCostElement {
  element: string
  current: number
  previous: number
  variance: number
  details: string[]
}

interface ProcessDataItem {
  process: string
  proc_type?: string
  frontend: number
  backend: number
  variance: number
  status: string
  costElements: ProcessCostElement[]
}

interface ProductImpactItem {
  product: string
  value: number
  color: string
  growth: number
}

interface AllocationDriverItem {
  driver: string
  current: number
  previous: number
  unit: string
  curr_cost?: number
  prev_cost?: number
  curr_rate?: number
  prev_rate?: number
}

/* ═══════════ Mock data (API 불가 시 폴백) ═══════════ */
const productGroupTrend = [
  { month: '08월', HBM: 480, 서버DRAM: 340, CXL: 175, 모바일DRAM: 265, 'PC DRAM': 360, NAND: 195, SSD: 88, CIS: 58 },
  { month: '09월', HBM: 510, 서버DRAM: 365, CXL: 195, 모바일DRAM: 250, 'PC DRAM': 345, NAND: 172, SSD: 105, CIS: 72 },
  { month: '10월', HBM: 495, 서버DRAM: 348, CXL: 210, 모바일DRAM: 278, 'PC DRAM': 355, NAND: 188, SSD: 92, CIS: 62 },
  { month: '11월', HBM: 545, 서버DRAM: 390, CXL: 188, 모바일DRAM: 295, 'PC DRAM': 330, NAND: 165, SSD: 115, CIS: 80 },
  { month: '12월', HBM: 530, 서버DRAM: 372, CXL: 235, 모바일DRAM: 260, 'PC DRAM': 340, NAND: 182, SSD: 98, CIS: 68 },
  { month: '01월', HBM: 585, 서버DRAM: 410, CXL: 248, 모바일DRAM: 310, 'PC DRAM': 310, NAND: 168, SSD: 118, CIS: 78 },
]

const PRODUCT_GROUP_COLORS: Record<string, string> = {
  HBM: '#3b82f6',
  서버DRAM: '#8b5cf6',
  CXL: '#6366f1',
  모바일DRAM: '#06b6d4',
  'PC DRAM': '#64748b',
  NAND: '#f59e0b',
  SSD: '#22c55e',
  CIS: '#ec4899',
}

const PRODUCT_GROUPS = Object.keys(PRODUCT_GROUP_COLORS)

const processData = [
  {
    process: '조립', frontend: 0, backend: 354, variance: 22.8, status: 'high',
    costElements: [
      { element: '재료비', current: 142, previous: 128, variance: 14, details: ['와이어본딩 +8.2억', '다이본딩 +3.8억', '몰딩 재료 +2.0억'] },
      { element: '감가상각비', current: 98, previous: 92, variance: 6, details: ['조립설비 신규 +4.5억', '기존설비 이월 +1.5억'] },
      { element: '인건비', current: 67, previous: 65, variance: 2, details: ['직접인건비 +1.2억', '간접인건비 +0.8억'] },
      { element: '전력비', current: 47, previous: 46, variance: 0.8, details: ['가동률 증가 +0.8억'] },
    ],
  },
  {
    process: '포토', frontend: 245, backend: 0, variance: 18.5, status: 'high',
    costElements: [
      { element: '감가상각비', current: 112, previous: 98, variance: 14, details: ['EUV 장비 신규 +10.2억', '기존 ArF 장비 +3.8억'] },
      { element: '재료비', current: 78, previous: 75, variance: 3, details: ['포토레지스트 +2.1억', '마스크비 +0.9억'] },
      { element: '전력비', current: 35, previous: 34, variance: 1, details: ['EUV 전력소모 증가 +1.0억'] },
      { element: '인건비', current: 20, previous: 19.5, variance: 0.5, details: ['숙련공 임금 상승 +0.5억'] },
    ],
  },
  {
    process: 'CMP', frontend: 167, backend: 0, variance: 15.6, status: 'high',
    costElements: [
      { element: '재료비', current: 98, previous: 89, variance: 9, details: ['슬러리 단가 상승 +5.2억', '패드비용 +2.8억', '린스액 +1.0억'] },
      { element: '감가상각비', current: 45, previous: 40, variance: 5, details: ['CMP 장비 추가 +5.0억'] },
      { element: '전력비', current: 14, previous: 12.5, variance: 1.5, details: ['가동시간 증가 +1.5억'] },
      { element: '인건비', current: 10, previous: 9.9, variance: 0.1, details: ['유지보수 인력 +0.1억'] },
    ],
  },
  {
    process: '식각', frontend: 198, backend: 0, variance: 12.2, status: 'high',
    costElements: [
      { element: '재료비', current: 89, previous: 82, variance: 7, details: ['에칭가스 +4.5억', '챔버부품 +2.5억'] },
      { element: '감가상각비', current: 65, previous: 61, variance: 4, details: ['식각설비 신규 +4.0억'] },
      { element: '전력비', current: 28, previous: 27, variance: 1, details: ['플라즈마 전력 +1.0억'] },
      { element: '인건비', current: 16, previous: 15.8, variance: 0.2, details: ['공정 엔지니어 +0.2억'] },
    ],
  },
  {
    process: '패키징', frontend: 0, backend: 287, variance: 8.9, status: 'medium',
    costElements: [
      { element: '재료비', current: 134, previous: 128, variance: 6, details: ['기판비용 +3.5억', '솔더볼 +2.5억'] },
      { element: '감가상각비', current: 78, previous: 75, variance: 3, details: ['패키징 라인 확장 +3.0억'] },
      { element: '인건비', current: 45, previous: 44.2, variance: 0.8, details: ['검사 인력 증원 +0.8억'] },
      { element: '전력비', current: 30, previous: 29.1, variance: 0.9, details: ['리플로우 전력 +0.9억'] },
    ],
  },
  {
    process: '증착', frontend: 223, backend: 0, variance: 8.3, status: 'medium',
    costElements: [
      { element: '재료비', current: 95, previous: 90, variance: 5, details: ['타겟재료 +3.2억', '가스류 +1.8억'] },
      { element: '감가상각비', current: 82, previous: 79, variance: 3, details: ['ALD 장비 +3.0억'] },
      { element: '인건비', current: 26, previous: 25.8, variance: 0.2, details: ['장비엔지니어 +0.2억'] },
      { element: '전력비', current: 20, previous: 19.9, variance: 0.1, details: ['가동률 소폭 증가 +0.1억'] },
    ],
  },
  {
    process: '이온주입', frontend: 134, backend: 0, variance: 4.2, status: 'low',
    costElements: [
      { element: '감가상각비', current: 72, previous: 69, variance: 3, details: ['이온주입기 감가 +3.0억'] },
      { element: '재료비', current: 38, previous: 37, variance: 1, details: ['가스 및 소모품 +1.0억'] },
      { element: '전력비', current: 16, previous: 15.8, variance: 0.2, details: ['전력비 소폭 증가 +0.2억'] },
      { element: '인건비', current: 8, previous: 7.9, variance: 0.1, details: [] },
    ],
  },
  {
    process: '검사', frontend: 89, backend: 0, variance: 2.1, status: 'low',
    costElements: [
      { element: '감가상각비', current: 48, previous: 47, variance: 1, details: ['검사장비 유지 +1.0억'] },
      { element: '인건비', current: 24, previous: 23.2, variance: 0.8, details: ['검사 인력 +0.8억'] },
      { element: '재료비', current: 11, previous: 10.8, variance: 0.2, details: ['소모품 +0.2억'] },
      { element: '전력비', current: 6, previous: 5.9, variance: 0.1, details: [] },
    ],
  },
  {
    process: '테스트', frontend: 0, backend: 201, variance: -5.2, status: 'decrease',
    costElements: [
      { element: '인건비', current: 68, previous: 72, variance: -4, details: ['자동화로 인력 감축 -4.0억'] },
      { element: '재료비', current: 65, previous: 66, variance: -1, details: ['테스트 보드 효율화 -1.0억'] },
      { element: '감가상각비', current: 48, previous: 48.2, variance: -0.2, details: [] },
      { element: '전력비', current: 20, previous: 20, variance: 0, details: [] },
    ],
  },
  {
    process: '웨이퍼', frontend: 112, backend: 0, variance: -3.4, status: 'decrease',
    costElements: [
      { element: '재료비', current: 78, previous: 81, variance: -3, details: ['웨이퍼 단가 하락 -3.0억'] },
      { element: '감가상각비', current: 22, previous: 22.2, variance: -0.2, details: [] },
      { element: '인건비', current: 8, previous: 8.1, variance: -0.1, details: [] },
      { element: '전력비', current: 4, previous: 4.1, variance: -0.1, details: [] },
    ],
  },
]

const costBreakdown: CostBreakdownItem[] = [
  {
    category: '감가상각비', amount: 842, change: 28.5, percent: 37.8,
    trend: [785, 798, 792, 810, 813, 842],
    subAccounts: [
      { name: '전공정 설비', amount: 485, change: 18.3, details: ['EUV 장비 신규 투입', '기존 설비 이월분 증가'],
        items: [
          { name: 'EUV 노광 설비', amount: 210, change: 10.2 },
          { name: 'ArF 식각 설비', amount: 125, change: 4.8 },
          { name: '증착/CMP 설비', amount: 95, change: 2.1 },
          { name: '이온주입 설비', amount: 55, change: 1.2 },
        ],
      },
      { name: '후공정 설비', amount: 267, change: 8.2, details: ['조립라인 확장', '패키징 설비 추가'],
        items: [
          { name: '와이어본더', amount: 98, change: 3.5 },
          { name: '몰딩 설비', amount: 72, change: 2.4 },
          { name: '패키징 라인', amount: 62, change: 1.5 },
          { name: '테스트 설비', amount: 35, change: 0.8 },
        ],
      },
      { name: '공통 설비', amount: 90, change: 2.0, details: ['유틸리티 설비', '검사 장비'],
        items: [
          { name: '유틸리티(냉각/공조)', amount: 52, change: 1.2 },
          { name: '검사/계측 장비', amount: 38, change: 0.8 },
        ],
      },
    ],
  },
  {
    category: '재료비', amount: 567, change: 16.2, percent: 25.5,
    trend: [530, 542, 535, 548, 551, 567],
    subAccounts: [
      { name: '원재료', amount: 285, change: 8.5, details: ['슬러리 단가 상승', '포토레지스트 증가'],
        items: [
          { name: 'CMP 슬러리', amount: 82, change: 3.5 },
          { name: '포토레지스트', amount: 68, change: 2.8 },
          { name: '에칭 가스', amount: 55, change: 1.2 },
          { name: '웨이퍼', amount: 80, change: 1.0 },
        ],
      },
      { name: '부재료', amount: 182, change: 5.2, details: ['가스류 가격 상승', '챔버 부품 교체 증가'],
        items: [
          { name: '특수 가스류', amount: 72, change: 2.4 },
          { name: '챔버 부품', amount: 58, change: 1.8 },
          { name: '타겟 재료', amount: 52, change: 1.0 },
        ],
      },
      { name: '포장재', amount: 100, change: 2.5, details: ['패키징 재료 증가', '기판 비용 상승'],
        items: [
          { name: '기판(Substrate)', amount: 48, change: 1.2 },
          { name: '솔더볼/범프', amount: 32, change: 0.8 },
          { name: '몰딩 컴파운드', amount: 20, change: 0.5 },
        ],
      },
    ],
  },
  {
    category: '인건비', amount: 334, change: 8.4, percent: 15.0,
    trend: [310, 315, 318, 322, 326, 334],
    subAccounts: [
      { name: '직접 인건비', amount: 198, change: 5.1, details: ['생산직 임금 인상', '숙련공 채용'],
        items: [
          { name: '전공정 오퍼레이터', amount: 95, change: 2.5 },
          { name: '후공정 오퍼레이터', amount: 68, change: 1.8 },
          { name: '장비 엔지니어', amount: 35, change: 0.8 },
        ],
      },
      { name: '간접 인건비', amount: 98, change: 2.5, details: ['엔지니어 증원', '관리직 승급'],
        items: [
          { name: '공정 엔지니어', amount: 52, change: 1.5 },
          { name: '품질 관리', amount: 28, change: 0.6 },
          { name: '생산 관리', amount: 18, change: 0.4 },
        ],
      },
      { name: '복리후생비', amount: 38, change: 0.8, details: ['복지 비용 증가'] },
    ],
  },
  {
    category: '전력비', amount: 256, change: 4.8, percent: 11.5,
    trend: [238, 245, 240, 248, 251, 256],
    subAccounts: [
      { name: '전공정 전력', amount: 165, change: 3.2, details: ['EUV 장비 전력 소모 증가', '가동률 상승'],
        items: [
          { name: 'EUV 노광 전력', amount: 62, change: 1.5 },
          { name: '식각/증착 전력', amount: 58, change: 1.0 },
          { name: 'CMP/세정 전력', amount: 45, change: 0.7 },
        ],
      },
      { name: '후공정 전력', amount: 67, change: 1.2, details: ['조립/패키징 가동 증가'],
        items: [
          { name: '리플로우 전력', amount: 32, change: 0.6 },
          { name: '테스트 전력', amount: 35, change: 0.6 },
        ],
      },
      { name: '공통 전력', amount: 24, change: 0.4, details: ['냉각 시스템', '공조 시스템'] },
    ],
  },
  {
    category: '운반비', amount: 143, change: 3.2, percent: 6.4,
    trend: [132, 136, 134, 138, 140, 143],
    subAccounts: [
      { name: '원재료 운반', amount: 78, change: 1.8, details: ['물류비 상승', '운송 빈도 증가'] },
      { name: '제품 출하', amount: 45, change: 1.0, details: ['택배비 인상'] },
      { name: '공정간 이동', amount: 20, change: 0.4, details: ['내부 물류 비용'] },
    ],
  },
  {
    category: '기타', amount: 85, change: 3.0, percent: 3.8,
    trend: [78, 80, 79, 82, 82, 85],
    subAccounts: [
      { name: '수선비', amount: 38, change: 1.5, details: ['설비 유지보수 증가'] },
      { name: '소모품비', amount: 28, change: 1.0, details: ['사무용품 및 각종 소모품'] },
      { name: '기타 경비', amount: 19, change: 0.5, details: ['잡비 및 기타'] },
    ],
  },
]

const productImpact = [
  { product: 'HBM', value: 45.3, color: '#3b82f6', growth: 8.9 },
  { product: 'SRAM', value: 22.3, color: '#8b5cf6', growth: 5.5 },
  { product: 'CAL', value: 14.4, color: '#ec4899', growth: 9.9 },
  { product: 'DDR', value: 13.2, color: '#f59e0b', growth: 4.8 },
  { product: 'DRAM', value: 4.6, color: '#10b981', growth: 1.4 },
  { product: 'CIS', value: 3.4, color: '#06b6d4', growth: 2.1 },
  { product: 'PC DRAM', value: -12.1, color: '#64748b', growth: -4.5 },
  { product: 'NAND', value: -20.4, color: '#ef4444', growth: -9.6 },
]

const allocationDrivers = [
  { driver: '설비 가동시간', current: 125800, previous: 118400, unit: '시간' },
  { driver: '생산 수량', current: 45600, previous: 43200, unit: 'K Units' },
  { driver: '전력 사용량', current: 89400, previous: 85600, unit: 'MWh' },
  { driver: '면적', current: 15200, previous: 15200, unit: 'm²' },
  { driver: '인원', current: 2340, previous: 2280, unit: '명' },
]

const radarData = [
  { subject: '재료비', current: 112, previous: 98, fullMark: 150 },
  { subject: '노무비', current: 125, previous: 115, fullMark: 150 },
  { subject: '경비', current: 98, previous: 85, fullMark: 150 },
  { subject: '감가상각', current: 142, previous: 110, fullMark: 150 },
  { subject: '전력비', current: 95, previous: 88, fullMark: 150 },
]

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b']

/* ═══════════ 메인 대시보드 컴포넌트 ═══════════ */
export default function DashboardPage({ selectedView }: DashboardPageProps) {
  const [yyyymm] = useState('202501')

  // ── API 호출 ──
  const { data: summary } = useQuery({
    queryKey: ['summary', yyyymm],
    queryFn: () => dashboardApi.getSummary(yyyymm).then(r => r.data),
  })

  const { data: trendResp } = useQuery({
    queryKey: ['trendByGroup', yyyymm],
    queryFn: () => dashboardApi.getTrendByProductGroup(yyyymm).then(r => r.data),
    enabled: selectedView === 'overview',
  })

  const { data: ceResp } = useQuery({
    queryKey: ['costElementDrilldown', yyyymm],
    queryFn: () => dashboardApi.getCostElementDrilldown(yyyymm).then(r => r.data),
    enabled: selectedView === 'overview',
  })

  const { data: byGroup } = useQuery({
    queryKey: ['byGroup', yyyymm],
    queryFn: () => dashboardApi.getByProductGroup(yyyymm).then(r => r.data),
    enabled: selectedView === 'overview' || selectedView === 'product',
  })

  const { data: procResp } = useQuery({
    queryKey: ['processSummary', yyyymm],
    queryFn: () => dashboardApi.getProcessSummary(yyyymm).then(r => r.data),
    enabled: selectedView === 'process',
  })

  const { data: allocResp } = useQuery({
    queryKey: ['allocSummary', yyyymm],
    queryFn: () => dashboardApi.getAllocSummary(yyyymm).then(r => r.data),
    enabled: selectedView === 'drivers',
  })

  // ── Summary (Hero Cards) ──
  const currTotal = summary?.curr_total?.toFixed(0) || '2,227'
  const prevTotal = summary?.prev_total?.toFixed(0) || '2,162'
  const diffTotal = summary?.diff ? (summary.diff > 0 ? '+' : '') + summary.diff.toFixed(1) : '+64.1'
  const diffRate = summary?.rate ? (summary.rate > 0 ? '+' : '') + summary.rate.toFixed(1) : '+3.0'

  // ── 추이 차트 데이터 변환 ──
  const apiTrend = trendResp?.trend || null
  const apiGroups = trendResp?.groups || null

  // ── 원가요소 드릴다운 데이터 변환 ──
  const apiCostBreakdown: CostBreakdownItem[] | null = ceResp?.items
    ? ceResp.items.map((item: any) => ({
        category: item.category,
        amount: item.amount,
        change: item.change,
        percent: item.percent,
        trend: item.trend,
        subAccounts: item.subAccounts.map((sa: any) => ({
          name: sa.name,
          amount: sa.amount,
          change: sa.change,
          details: sa.details || [],
          items: sa.items || [],
        })),
      }))
    : null

  // ── 공정별 데이터 변환 (ProcessCostElement 인터페이스에 맞춤) ──
  const apiProcessData: ProcessDataItem[] | null = procResp?.items
    ? procResp.items.map((p: any) => ({
        process: p.proc_nm.replace('전공정_', '').replace('후공정_', ''),
        proc_type: p.proc_type,
        frontend: p.proc_type === 'FE' ? p.curr_amt : 0,
        backend: p.proc_type === 'BE' ? p.curr_amt : 0,
        variance: p.diff,
        status: Math.abs(p.diff) > 20 ? 'high' : Math.abs(p.diff) > 5 ? 'medium' : p.diff < 0 ? 'decrease' : 'normal',
        costElements: p.costElements.map((ce: any) => ({
          element: ce.name,
          current: ce.amount,
          previous: ce.prevAmount,
          variance: Math.round((ce.amount - ce.prevAmount) * 10) / 10,
          details: [] as string[],
        })),
      }))
    : null

  // ── 제품군별 데이터 변환 ──
  const apiProductImpact: ProductImpactItem[] | null = byGroup?.items
    ? byGroup.items.map((item: any, idx: number) => ({
        product: item.product_grp,
        value: item.diff,
        color: PRODUCT_GROUP_COLORS[item.product_grp] || PIE_COLORS[idx % PIE_COLORS.length],
        growth: item.rate,
      }))
    : null

  // ── 배부기준 데이터 변환 ──
  const apiDrivers: AllocationDriverItem[] | null = allocResp?.items
    ? allocResp.items.map((item: any) => ({
        driver: `${item.proc_nm} · ${item.ce_nm}`,
        current: item.current.total_base,
        previous: item.previous.total_base,
        unit: item.unit,
        curr_cost: item.current.total_cost,
        prev_cost: item.previous.total_cost,
        curr_rate: item.current.alloc_rate,
        prev_rate: item.previous.alloc_rate,
      }))
    : null

  return (
    <AnimatePresence mode="wait">
      {selectedView === 'overview' && (
        <OverviewView
          costBreakdown={apiCostBreakdown || costBreakdown}
          currTotal={currTotal}
          prevTotal={prevTotal}
          diffTotal={diffTotal}
          diffRate={diffRate}
          trendData={apiTrend || productGroupTrend}
          trendGroups={apiGroups || PRODUCT_GROUPS}
        />
      )}
      {selectedView === 'process' && <ProcessView data={apiProcessData || processData} />}
      {selectedView === 'product' && <ProductView data={apiProductImpact || productImpact} />}
      {selectedView === 'drivers' && <DriversView data={apiDrivers || allocationDrivers} />}
      {selectedView === 'network' && <NetworkView />}
    </AnimatePresence>
  )
}

/* ═══════════ Overview View ═══════════ */
function OverviewView({
  costBreakdown,
  currTotal,
  prevTotal,
  diffTotal,
  diffRate,
  trendData,
  trendGroups,
}: {
  costBreakdown: CostBreakdownItem[]
  currTotal: string
  prevTotal: string
  diffTotal: string
  diffRate: string
  trendData: any[]
  trendGroups: string[]
}) {
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const [expandedSub, setExpandedSub] = useState<string | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Hero Cards */}
      <div className="grid grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <Badge className="bg-white/20 text-white border-0">당월</Badge>
            </div>
            <div className="text-3xl font-bold mb-1">{currTotal}억</div>
            <div className="text-blue-100 text-sm">총 제조원가</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-700 to-slate-800 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Activity className="w-6 h-6" />
              </div>
              <Badge className="bg-white/20 text-white border-0">전월</Badge>
            </div>
            <div className="text-3xl font-bold mb-1">{prevTotal}억</div>
            <div className="text-slate-300 text-sm">기준 원가</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <Badge className="bg-white/20 text-white border-0">증감</Badge>
            </div>
            <div className="text-3xl font-bold mb-1">{diffTotal}억</div>
            <div className="text-red-100 text-sm">원가 증가액</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Zap className="w-6 h-6" />
              </div>
              <Badge className="bg-white/20 text-white border-0">변동률</Badge>
            </div>
            <div className="text-3xl font-bold mb-1">{diffRate}%</div>
            <div className="text-orange-100 text-sm">증감률</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Product Group Trend */}
        <Card className="col-span-2 shadow-lg border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">제품군별 원가 추이</h3>
                <p className="text-sm text-slate-500">최근 6개월 제품군별 월별 추이 (억원)</p>
              </div>
              <Badge variant="outline" className="gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                HBM 급증
              </Badge>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: number, name: string) => [`${value}억`, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
                {trendGroups.map((grp) => (
                  <Line
                    key={grp}
                    type="monotone"
                    dataKey={grp}
                    stroke={PRODUCT_GROUP_COLORS[grp] || '#94a3b8'}
                    strokeWidth={grp === 'HBM' ? 3 : 2}
                    dot={{ r: grp === 'HBM' ? 4 : 2, fill: PRODUCT_GROUP_COLORS[grp] || '#94a3b8' }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="shadow-lg border-slate-200">
          <CardContent className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900">원가 구성</h3>
              <p className="text-sm text-slate-500">당월 비중</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={costBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="percent"
                >
                  {costBreakdown.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${value}%`}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cost Element Breakdown with Drilldown + Sparklines */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">원가요소별 증감 상세 (차이 큰 순)</h3>
            <p className="text-sm text-slate-500">클릭하여 세부 계정 확인 · 하위 항목까지 드릴다운</p>
          </div>

          <div className="space-y-3">
            {[...costBreakdown]
              .sort((a, b) => b.change - a.change)
              .map((item, index) => {
                const prevAmt = item.amount - item.change
                const changeRate = prevAmt !== 0 ? ((item.change / prevAmt) * 100).toFixed(1) : '0.0'
                const months = ['8월', '9월', '10월', '11월', '12월', '1월']
                return (
                  <CostElementCard
                    key={item.category}
                    item={item}
                    index={index}
                    changeRate={changeRate}
                    months={months}
                    color={PIE_COLORS[costBreakdown.indexOf(item)]}
                    isExpanded={expandedAccount === item.category}
                    onToggle={() => setExpandedAccount(expandedAccount === item.category ? null : item.category)}
                    expandedSub={expandedSub}
                    onToggleSub={(subName: string) => setExpandedSub(expandedSub === subName ? null : subName)}
                  />
                )
              })}
          </div>
        </CardContent>
      </Card>

      {/* Radar Chart */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">원가요소 비교 레이더</h3>
            <p className="text-sm text-slate-500">당월 vs 전월 다차원 비교</p>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={costBreakdown.slice(0, 6).map(item => ({
              subject: item.category,
              current: item.amount,
              previous: item.amount - item.change,
              fullMark: Math.max(...costBreakdown.map(b => b.amount)) * 1.2,
            }))}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" stroke="#64748b" />
              <PolarRadiusAxis stroke="#94a3b8" />
              <Radar name="당월" dataKey="current" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              <Radar name="전월" dataKey="previous" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.3} />
              <Legend />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ═══════════ 인라인 스파크라인 (SVG) ═══════════ */
function MiniSparkline({ data, color = '#ef4444', width = 80, height = 28 }: {
  data: number[], color?: string, width?: number, height?: number
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 마지막 점 강조 */}
      {(() => {
        const lastX = width
        const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2
        return <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
      })()}
    </svg>
  )
}

/* ═══════════ 원가요소 카드 컴포넌트 ═══════════ */
function CostElementCard({
  item, index, changeRate, months, color, isExpanded, onToggle, expandedSub, onToggleSub,
}: {
  item: CostBreakdownItem
  index: number
  changeRate: string
  months: string[]
  color: string
  isExpanded: boolean
  onToggle: () => void
  expandedSub: string | null
  onToggleSub: (name: string) => void
}) {
  return (
    <div>
      {/* ── 헤더 (클릭하면 하위 펼침) ── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={onToggle}
        className={`p-5 rounded-xl border-2 transition-all cursor-pointer ${
          isExpanded
            ? 'bg-white border-blue-200 shadow-lg'
            : 'bg-gradient-to-r from-slate-50 to-white border-slate-200 hover:shadow-md'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-semibold text-slate-900">{item.category}</span>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </motion.div>
          </div>
          <Badge className={item.change > 0 ? 'bg-red-100 text-red-700 border-0' : 'bg-blue-100 text-blue-700 border-0'}>
            {item.change > 0 ? '+' : ''}{item.change}억
          </Badge>
        </div>

        <div className="flex items-end justify-between">
          {/* 왼쪽: 금액 + 비중 */}
          <div>
            <div className="text-2xl font-bold text-slate-900">{item.amount}억</div>
            <div className="text-xs text-slate-500">전체의 {item.percent}%</div>
          </div>

          {/* 오른쪽: 전월 대비 (크게) + 6개월 스파크라인 */}
          <div className="flex items-center gap-4">
            {/* 전월대비 */}
            <div className="text-right">
              <div className={`text-2xl font-extrabold ${item.change > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                {item.change > 0 ? '+' : ''}{changeRate}%
              </div>
              <div className="text-[11px] text-slate-400">전월 대비</div>
            </div>

            {/* 6개월 스파크라인 + 수치 */}
            <div className="flex flex-col items-end gap-0.5 pl-3 border-l border-slate-200">
              <MiniSparkline data={item.trend} color={item.change > 0 ? '#ef4444' : '#3b82f6'} width={120} height={30} />
              <div className="flex gap-[2px]">
                {item.trend.map((v, i) => (
                  <span key={i} className="text-[8px] text-slate-400 w-[20px] text-center leading-none">
                    {months[i]}
                  </span>
                ))}
              </div>
              <div className="flex gap-[2px]">
                {item.trend.map((v, i) => (
                  <span key={i} className="text-[8px] text-slate-500 w-[20px] text-center font-medium leading-none">
                    {Math.round(v)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── 1단 드릴다운: 하위 계정 ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="ml-6 mt-2 space-y-2 overflow-hidden"
          >
            {item.subAccounts?.map((sub, subIdx) => (
              <div key={sub.name}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: subIdx * 0.08 }}
                  onClick={(e) => { e.stopPropagation(); if (sub.items?.length) onToggleSub(sub.name) }}
                  className={`p-4 rounded-lg border shadow-sm transition-all ${
                    sub.items?.length ? 'cursor-pointer hover:shadow-md' : ''
                  } ${
                    expandedSub === sub.name ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {sub.items?.length ? (
                        <motion.div
                          animate={{ rotate: expandedSub === sub.name ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </motion.div>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      )}
                      <span className="font-medium text-slate-700">{sub.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700">{sub.amount}억</span>
                      <Badge className={`border-0 text-xs ${sub.change > 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                        {sub.change > 0 ? '+' : ''}{sub.change}억
                      </Badge>
                    </div>
                  </div>
                  {/* 설명 */}
                  <div className="ml-6 mt-1.5 space-y-0.5">
                    {sub.details.map((detail, detailIdx) => (
                      <div key={detailIdx} className="text-xs text-slate-500 flex items-center gap-2">
                        <div className="w-1 h-1 bg-slate-400 rounded-full" />
                        {detail}
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* ── 2단 드릴다운: 세부 항목 ── */}
                <AnimatePresence>
                  {expandedSub === sub.name && sub.items && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="ml-8 mt-1.5 space-y-1.5 overflow-hidden"
                    >
                      {sub.items.map((itm, itmIdx) => (
                        <motion.div
                          key={itm.name}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: itmIdx * 0.06 }}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="text-sm text-slate-600">{itm.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600">{itm.amount}억</span>
                            <span className={`text-xs font-semibold ${itm.change > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                              {itm.change > 0 ? '+' : ''}{itm.change}억
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════ Process View — 수평 파이프라인 ═══════════ */
function ProcessView({ data }: { data: ProcessDataItem[] }) {
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null)

  // 공정 순서: 전공정 → 후공정
  const feProcesses = data.filter(p => p.proc_type === 'FE' || (!p.proc_type && p.frontend > 0))
  const beProcesses = data.filter(p => p.proc_type === 'BE' || (!p.proc_type && p.backend > 0))
  const selected = data.find(p => p.process === selectedProcess)

  const getVarianceColor = (v: number) => {
    if (v > 15) return { bg: 'from-red-500 to-red-600', ring: 'ring-red-300', text: 'text-white' }
    if (v > 5) return { bg: 'from-orange-400 to-orange-500', ring: 'ring-orange-200', text: 'text-white' }
    if (v > 0) return { bg: 'from-amber-400 to-yellow-400', ring: 'ring-yellow-200', text: 'text-slate-900' }
    return { bg: 'from-blue-400 to-blue-500', ring: 'ring-blue-200', text: 'text-white' }
  }

  const ProcessNode = ({ process }: { process: ProcessDataItem }) => {
    const isActive = selectedProcess === process.process
    const colors = getVarianceColor(process.variance)
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setSelectedProcess(isActive ? null : process.process)}
        className={`relative cursor-pointer flex-shrink-0`}
      >
        <div
          className={`w-[100px] h-[100px] rounded-2xl bg-gradient-to-br ${colors.bg} shadow-lg flex flex-col items-center justify-center transition-all ${
            isActive ? `ring-4 ${colors.ring} shadow-2xl scale-105` : 'hover:shadow-xl'
          }`}
        >
          <span className={`text-sm font-bold ${colors.text}`}>{process.process}</span>
          <span className={`text-lg font-extrabold ${colors.text} mt-0.5`}>
            {process.variance > 0 ? '+' : ''}{process.variance}
          </span>
          <span className={`text-[10px] ${colors.text} opacity-80`}>억원</span>
        </div>
        {/* 선택 인디케이터 */}
        {isActive && (
          <motion.div
            layoutId="processIndicator"
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-blue-500"
          />
        )}
      </motion.div>
    )
  }

  const ArrowConnector = () => (
    <div className="flex items-center flex-shrink-0 mx-1">
      <div className="w-6 h-[2px] bg-slate-300" />
      <ChevronRight className="w-4 h-4 text-slate-300 -ml-1" />
    </div>
  )

  const SectionDivider = () => (
    <div className="flex items-center flex-shrink-0 mx-3">
      <div className="w-[2px] h-16 bg-slate-200 rounded-full" />
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">공정별 원가 분석</h2>
          <p className="text-slate-500">공정을 클릭하면 주요 비용 계정이 표시됩니다</p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-blue-100 text-blue-700 border-0 px-3 py-1.5 text-xs">전공정 {feProcesses.length}개</Badge>
          <Badge className="bg-purple-100 text-purple-700 border-0 px-3 py-1.5 text-xs">후공정 {beProcesses.length}개</Badge>
        </div>
      </div>

      {/* 공정 파이프라인 */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-6">
          {/* 범례 */}
          <div className="flex items-center gap-4 mb-6 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">차이 크기:</span>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gradient-to-br from-red-500 to-red-600" /><span>&gt;15억</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gradient-to-br from-orange-400 to-orange-500" /><span>5~15억</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gradient-to-br from-amber-400 to-yellow-400" /><span>0~5억</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gradient-to-br from-blue-400 to-blue-500" /><span>감소</span></div>
          </div>

          {/* 전공정 라벨 */}
          <div className="mb-2">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">전공정 (FAB)</span>
          </div>

          {/* 전공정 플로우 */}
          <div className="flex items-center overflow-x-auto pb-2 mb-4">
            {feProcesses.map((p, i) => (
              <div key={p.process} className="flex items-center">
                <ProcessNode process={p} />
                {i < feProcesses.length - 1 && <ArrowConnector />}
              </div>
            ))}
          </div>

          {/* 후공정 라벨 */}
          <div className="mb-2 mt-2">
            <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">후공정 (패키징)</span>
          </div>

          {/* 후공정 플로우 */}
          <div className="flex items-center overflow-x-auto pb-2">
            {beProcesses.map((p, i) => (
              <div key={p.process} className="flex items-center">
                <ProcessNode process={p} />
                {i < beProcesses.length - 1 && <ArrowConnector />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 선택된 공정 상세 */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.process}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-xl border-2 border-blue-400">
              <CardContent className="p-6">
                {/* 공정 헤더 */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${selected.frontend > 0 ? 'bg-blue-100' : 'bg-purple-100'}`}>
                      {selected.frontend > 0 ? (
                        <Cpu className="w-7 h-7 text-blue-600" />
                      ) : (
                        <Package className="w-7 h-7 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-slate-900">{selected.process} 공정</h3>
                        <Badge className={`border-0 ${selected.frontend > 0 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {selected.frontend > 0 ? '전공정' : '후공정'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">총 원가 {selected.frontend + selected.backend}억원</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-extrabold ${selected.variance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {selected.variance > 0 ? '+' : ''}{selected.variance}억
                    </div>
                    <div className="text-xs text-slate-500">전월 대비 차이</div>
                  </div>
                </div>

                {/* 비용 계정 카드 그리드 */}
                <div className="grid grid-cols-4 gap-4">
                  {[...selected.costElements]
                    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
                    .map((element, elIdx) => {
                      const total = selected.costElements.reduce((s, e) => s + Math.abs(e.variance), 0)
                      const pct = total > 0 ? (Math.abs(element.variance) / total * 100) : 0
                      const elementColor =
                        element.element === '재료비' ? { icon: <Package className="w-5 h-5" />, bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-400' } :
                        element.element === '감가상각비' ? { icon: <Factory className="w-5 h-5" />, bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-400' } :
                        element.element === '인건비' ? { icon: <Activity className="w-5 h-5" />, bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-400' } :
                        { icon: <Zap className="w-5 h-5" />, bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-400' }

                      return (
                        <motion.div
                          key={element.element}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: elIdx * 0.08 }}
                          className={`rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow`}
                        >
                          {/* 컬러 헤더 */}
                          <div className={`${elementColor.bg} px-4 py-3 text-white flex items-center justify-between`}>
                            <div className="flex items-center gap-2">
                              {elementColor.icon}
                              <span className="font-bold text-sm">{element.element}</span>
                            </div>
                            <span className="text-lg font-extrabold">
                              {element.variance > 0 ? '+' : ''}{element.variance}억
                            </span>
                          </div>
                          {/* 바디 */}
                          <div className="p-4 bg-white">
                            <div className="flex justify-between text-xs text-slate-500 mb-2">
                              <span>전월 <strong className="text-slate-700">{element.previous}억</strong></span>
                              <span>당월 <strong className="text-slate-700">{element.current}억</strong></span>
                            </div>
                            {/* 비중 바 */}
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className={`h-full rounded-full ${elementColor.bar}`}
                              />
                            </div>
                            {/* 세부내역 */}
                            {element.details.length > 0 && (
                              <div className="space-y-1">
                                {element.details.map((detail, i) => (
                                  <div key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${elementColor.bar} mt-1 flex-shrink-0`} />
                                    {detail}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 미선택 시 안내 */}
      {!selected && (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
          <CardContent className="p-12 text-center">
            <div className="text-slate-400 mb-2">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
            </div>
            <p className="text-slate-500 font-medium">위 공정 노드를 클릭하면 비용 계정 상세가 표시됩니다</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}

/* ═══════════ Product View ═══════════ */
function ProductView({ data }: { data: ProductImpactItem[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900">제품별 원가 영향 분석</h2>
        <p className="text-slate-500">제품군별 원가 증감 및 성장률 분석</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {data.map((product, idx) => (
          <motion.div
            key={product.product}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ y: -4 }}
          >
            <Card className="shadow-lg border-slate-200 overflow-hidden">
              <div className="h-2" style={{ backgroundColor: product.color }} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-sm text-slate-500 mb-1">제품군</div>
                    <div className="text-xl font-bold text-slate-900">{product.product}</div>
                  </div>
                  {Math.abs(product.value) > 20 && (
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">원가 변동</div>
                    <div className={`text-2xl font-bold ${product.value > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {product.value > 0 ? '+' : ''}{product.value}억
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">증감률</div>
                    <div className="flex items-center gap-2">
                      {product.growth > 0 ? (
                        <TrendingUp className="w-4 h-4 text-red-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-blue-500" />
                      )}
                      <span className={`font-bold ${product.growth > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {product.growth > 0 ? '+' : ''}{product.growth}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Product Comparison Chart */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">제품별 원가 증감 비교</h3>
            <p className="text-sm text-slate-500">각 제품의 원가 변동 폭</p>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#64748b" />
              <YAxis dataKey="product" type="category" stroke="#64748b" width={80} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#ef4444' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Product Growth Matrix */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">제품 포트폴리오 매트릭스</h3>
            <p className="text-sm text-slate-500">원가 변동 vs 성장률</p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 bg-red-50 rounded-xl border-2 border-red-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-red-200 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-red-700" />
                </div>
                <span className="font-bold text-red-900">고성장 / 원가증가</span>
              </div>
              <div className="space-y-2">
                {data.filter(p => p.growth > 5 && p.value > 10).map(p => (
                  <div key={p.product} className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span className="font-medium text-slate-900">{p.product}</span>
                    <span className="text-red-600 font-bold">+{p.value}억</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-blue-700" />
                </div>
                <span className="font-bold text-blue-900">저성장 / 원가감소</span>
              </div>
              <div className="space-y-2">
                {data.filter(p => p.growth < 0 || p.value < 0).map(p => (
                  <div key={p.product} className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span className="font-medium text-slate-900">{p.product}</span>
                    <span className="text-blue-600 font-bold">{p.value}억</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ═══════════ Drivers View ═══════════ */
function DriversView({ data }: { data: AllocationDriverItem[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900">배부기준 변동 분석</h2>
        <p className="text-slate-500">주요 배부 드라이버별 변동 현황 및 MES/PLM 연계</p>
      </div>

      {data.map((driver, idx) => {
        const change = driver.current - driver.previous
        const changePercent = driver.previous !== 0 ? ((change / driver.previous) * 100).toFixed(1) : '0.0'

        return (
          <motion.div
            key={driver.driver}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="shadow-lg border-slate-200 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                      <Zap className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{driver.driver}</h3>
                      <p className="text-sm text-slate-500">배부 기준 드라이버</p>
                    </div>
                  </div>
                  <Badge className="px-4 py-2 text-sm bg-blue-100 text-blue-700 border-0">MES 연동</Badge>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">전월 배부기준</div>
                    <div className="text-2xl font-bold text-slate-700">{driver.previous.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 mt-1">{driver.unit}</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <div className="text-xs text-blue-600 mb-1">당월 배부기준</div>
                    <div className="text-2xl font-bold text-blue-700">{driver.current.toLocaleString()}</div>
                    <div className="text-xs text-blue-600 mt-1">{driver.unit}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${change > 0 ? 'bg-red-50 border-2 border-red-200' : 'bg-green-50 border-2 border-green-200'}`}>
                    <div className={`text-xs mb-1 ${change > 0 ? 'text-red-600' : 'text-green-600'}`}>기준 변동</div>
                    <div className="flex items-center gap-2">
                      {change > 0 ? (
                        <TrendingUp className="w-5 h-5 text-red-600" />
                      ) : change < 0 ? (
                        <TrendingDown className="w-5 h-5 text-green-600" />
                      ) : null}
                      <div className={`text-2xl font-bold ${change > 0 ? 'text-red-700' : change < 0 ? 'text-green-700' : 'text-slate-700'}`}>
                        {change > 0 ? '+' : ''}{changePercent}%
                      </div>
                    </div>
                  </div>
                  {driver.curr_rate != null && driver.prev_rate != null && (
                    <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                      <div className="text-xs text-purple-600 mb-1">배부율 변동</div>
                      <div className="text-lg font-bold text-purple-700">
                        {driver.prev_rate.toLocaleString()} → {driver.curr_rate.toLocaleString()}
                      </div>
                      <div className={`text-xs font-semibold mt-1 ${driver.curr_rate > driver.prev_rate ? 'text-red-600' : 'text-green-600'}`}>
                        {driver.curr_rate > driver.prev_rate ? '+' : ''}{(driver.curr_rate - driver.prev_rate).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>변동 추이</span>
                    <span>{change > 0 ? '+' : ''}{change.toLocaleString()} {driver.unit}</span>
                  </div>
                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.abs(parseFloat(changePercent)), 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        change > 0 ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-green-400 to-green-600'
                      }`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}

      {/* System Integration */}
      <Card className="shadow-lg border-slate-200 bg-gradient-to-br from-slate-50 to-white">
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">시스템 연계 현황</h3>
            <p className="text-sm text-slate-500">MES, PLM, ERP 실시간 데이터 통합</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { system: 'MES', lastSync: '2분 전', records: '1,245건' },
              { system: 'PLM', lastSync: '5분 전', records: '834건' },
              { system: 'SAP ERP', lastSync: '1분 전', records: '2,891건' },
            ].map((sys, idx) => (
              <motion.div
                key={sys.system}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-5 bg-white rounded-xl border-2 border-slate-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-900">{sys.system}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-600">연결됨</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>마지막 동기화: {sys.lastSync}</div>
                  <div>처리 레코드: {sys.records}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ═══════════ Network View ═══════════ */
function NetworkView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <CostNetworkGraph />
    </motion.div>
  )
}
