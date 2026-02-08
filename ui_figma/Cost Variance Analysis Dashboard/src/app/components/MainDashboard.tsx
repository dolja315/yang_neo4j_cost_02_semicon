import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Download, 
  RefreshCw,
  Zap,
  Layers,
  DollarSign,
  Activity,
  AlertCircle,
  ChevronRight,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  Package,
  Cpu,
  Factory,
  Network
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { motion, AnimatePresence } from 'motion/react';
import { CostNetworkGraph } from './CostNetworkGraph';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
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
  Radar
} from 'recharts';

// Mock data
const monthlyTrend = [
  { month: '08월', cost: 2080, target: 2100 },
  { month: '09월', cost: 2120, target: 2100 },
  { month: '10월', cost: 2095, target: 2100 },
  { month: '11월', cost: 2145, target: 2100 },
  { month: '12월', cost: 2162, target: 2100 },
  { month: '01월', cost: 2227, target: 2100 }
];

const processData = [
  { 
    process: '조립', 
    frontend: 0, 
    backend: 354, 
    variance: 22.8, 
    status: 'high',
    costElements: [
      { element: '재료비', current: 142, previous: 128, variance: 14, details: ['와이어본딩 +8.2억', '다이본딩 +3.8억', '몰딩 재료 +2.0억'] },
      { element: '감가상각비', current: 98, previous: 92, variance: 6, details: ['조립설비 신규 +4.5억', '기존설비 이월 +1.5억'] },
      { element: '인건비', current: 67, previous: 65, variance: 2, details: ['직접인건비 +1.2억', '간접인건비 +0.8억'] },
      { element: '전력비', current: 47, previous: 46, variance: 0.8, details: ['가동률 증가 +0.8억'] }
    ]
  },
  { 
    process: '포토', 
    frontend: 245, 
    backend: 0, 
    variance: 18.5, 
    status: 'high',
    costElements: [
      { element: '감가상각비', current: 112, previous: 98, variance: 14, details: ['EUV 장비 신규 +10.2억', '기존 ArF 장비 +3.8억'] },
      { element: '재료비', current: 78, previous: 75, variance: 3, details: ['포토레지스트 +2.1억', '마스크비 +0.9억'] },
      { element: '전력비', current: 35, previous: 34, variance: 1, details: ['EUV 전력소모 증가 +1.0억'] },
      { element: '인건비', current: 20, previous: 19.5, variance: 0.5, details: ['숙련공 임금 상승 +0.5억'] }
    ]
  },
  { 
    process: 'CMP', 
    frontend: 167, 
    backend: 0, 
    variance: 15.6, 
    status: 'high',
    costElements: [
      { element: '재료비', current: 98, previous: 89, variance: 9, details: ['슬러리 단가 상승 +5.2억', '패드비용 +2.8억', '린스액 +1.0억'] },
      { element: '감가상각비', current: 45, previous: 40, variance: 5, details: ['CMP 장비 추가 +5.0억'] },
      { element: '전력비', current: 14, previous: 12.5, variance: 1.5, details: ['가동시간 증가 +1.5억'] },
      { element: '인건비', current: 10, previous: 9.9, variance: 0.1, details: ['유지보수 인력 +0.1억'] }
    ]
  },
  { 
    process: '식각', 
    frontend: 198, 
    backend: 0, 
    variance: 12.2, 
    status: 'high',
    costElements: [
      { element: '재료비', current: 89, previous: 82, variance: 7, details: ['에칭가스 +4.5억', '챔버부품 +2.5억'] },
      { element: '감가상각비', current: 65, previous: 61, variance: 4, details: ['식각설비 신규 +4.0억'] },
      { element: '전력비', current: 28, previous: 27, variance: 1, details: ['플라즈마 전력 +1.0억'] },
      { element: '인건비', current: 16, previous: 15.8, variance: 0.2, details: ['공정 엔지니어 +0.2억'] }
    ]
  },
  { 
    process: '패키징', 
    frontend: 0, 
    backend: 287, 
    variance: 8.9, 
    status: 'medium',
    costElements: [
      { element: '재료비', current: 134, previous: 128, variance: 6, details: ['기판비용 +3.5억', '솔더볼 +2.5억'] },
      { element: '감가상각비', current: 78, previous: 75, variance: 3, details: ['패키징 라인 확장 +3.0억'] },
      { element: '인건비', current: 45, previous: 44.2, variance: 0.8, details: ['검사 인력 증원 +0.8억'] },
      { element: '전력비', current: 30, previous: 29.1, variance: 0.9, details: ['리플로우 전력 +0.9억'] }
    ]
  },
  { 
    process: '증착', 
    frontend: 223, 
    backend: 0, 
    variance: 8.3, 
    status: 'medium',
    costElements: [
      { element: '재료비', current: 95, previous: 90, variance: 5, details: ['타겟재료 +3.2억', '가스류 +1.8억'] },
      { element: '감가상각비', current: 82, previous: 79, variance: 3, details: ['ALD 장비 +3.0억'] },
      { element: '인건비', current: 26, previous: 25.8, variance: 0.2, details: ['장비엔지니어 +0.2억'] },
      { element: '전력비', current: 20, previous: 19.9, variance: 0.1, details: ['가동률 소폭 증가 +0.1억'] }
    ]
  },
  { 
    process: '이온주입', 
    frontend: 134, 
    backend: 0, 
    variance: 4.2, 
    status: 'low',
    costElements: [
      { element: '감가상각비', current: 72, previous: 69, variance: 3, details: ['이온주입기 감가 +3.0억'] },
      { element: '재료비', current: 38, previous: 37, variance: 1, details: ['가스 및 소모품 +1.0억'] },
      { element: '전력비', current: 16, previous: 15.8, variance: 0.2, details: ['전력비 소폭 증가 +0.2억'] },
      { element: '인건비', current: 8, previous: 7.9, variance: 0.1, details: [] }
    ]
  },
  { 
    process: '검사', 
    frontend: 89, 
    backend: 0, 
    variance: 2.1, 
    status: 'low',
    costElements: [
      { element: '감가상각비', current: 48, previous: 47, variance: 1, details: ['검사장비 유지 +1.0억'] },
      { element: '인건비', current: 24, previous: 23.2, variance: 0.8, details: ['검사 인력 +0.8억'] },
      { element: '재료비', current: 11, previous: 10.8, variance: 0.2, details: ['소모품 +0.2억'] },
      { element: '전력비', current: 6, previous: 5.9, variance: 0.1, details: [] }
    ]
  },
  { 
    process: '테스트', 
    frontend: 0, 
    backend: 201, 
    variance: -5.2, 
    status: 'decrease',
    costElements: [
      { element: '인건비', current: 68, previous: 72, variance: -4, details: ['자동화로 인력 감축 -4.0억'] },
      { element: '재료비', current: 65, previous: 66, variance: -1, details: ['테스트 보드 효율화 -1.0억'] },
      { element: '감가상각비', current: 48, previous: 48.2, variance: -0.2, details: [] },
      { element: '전력비', current: 20, previous: 20, variance: 0, details: [] }
    ]
  },
  { 
    process: '웨이퍼', 
    frontend: 112, 
    backend: 0, 
    variance: -3.4, 
    status: 'decrease',
    costElements: [
      { element: '재료비', current: 78, previous: 81, variance: -3, details: ['웨이퍼 단가 하락 -3.0억'] },
      { element: '감가상각비', current: 22, previous: 22.2, variance: -0.2, details: [] },
      { element: '인건비', current: 8, previous: 8.1, variance: -0.1, details: [] },
      { element: '전력비', current: 4, previous: 4.1, variance: -0.1, details: [] }
    ]
  }
];

const costBreakdown = [
  { 
    category: '감가상각비', 
    amount: 842, 
    change: 28.5, 
    percent: 37.8,
    subAccounts: [
      { name: '전공정 설비', amount: 485, change: 18.3, details: ['EUV 장비 신규 투입', '기존 설비 이월분 증가'] },
      { name: '후공정 설비', amount: 267, change: 8.2, details: ['조립라인 확장', '패키징 설비 추가'] },
      { name: '공통 설비', amount: 90, change: 2.0, details: ['유틸리티 설비', '검사 장비'] }
    ]
  },
  { 
    category: '재료비', 
    amount: 567, 
    change: 16.2, 
    percent: 25.5,
    subAccounts: [
      { name: '원재료', amount: 285, change: 8.5, details: ['슬러리 단가 상승', '포토레지스트 증가'] },
      { name: '부재료', amount: 182, change: 5.2, details: ['가스류 가격 상승', '챔버 부품 교체 증가'] },
      { name: '포장재', amount: 100, change: 2.5, details: ['패키징 재료 증가', '기판 비용 상승'] }
    ]
  },
  { 
    category: '인건비', 
    amount: 334, 
    change: 8.4, 
    percent: 15.0,
    subAccounts: [
      { name: '직접 인건비', amount: 198, change: 5.1, details: ['생산직 임금 인상', '숙련공 채용'] },
      { name: '간접 인건비', amount: 98, change: 2.5, details: ['엔지니어 증원', '관리직 승급'] },
      { name: '복리후생비', amount: 38, change: 0.8, details: ['복지 비용 증가'] }
    ]
  },
  { 
    category: '전력비', 
    amount: 256, 
    change: 4.8, 
    percent: 11.5,
    subAccounts: [
      { name: '전공정 전력', amount: 165, change: 3.2, details: ['EUV 장비 전력 소모 증가', '가동률 상승'] },
      { name: '후공정 전력', amount: 67, change: 1.2, details: ['조립/패키징 가동 증가'] },
      { name: '공통 전력', amount: 24, change: 0.4, details: ['냉각 시스템', '공조 시스템'] }
    ]
  },
  { 
    category: '운반비', 
    amount: 143, 
    change: 3.2, 
    percent: 6.4,
    subAccounts: [
      { name: '원재료 운반', amount: 78, change: 1.8, details: ['물류비 상승', '운송 빈도 증가'] },
      { name: '제품 출하', amount: 45, change: 1.0, details: ['택배비 인상'] },
      { name: '공정간 이동', amount: 20, change: 0.4, details: ['내부 물류 비용'] }
    ]
  },
  { 
    category: '기타', 
    amount: 85, 
    change: 3.0, 
    percent: 3.8,
    subAccounts: [
      { name: '수선비', amount: 38, change: 1.5, details: ['설비 유지보수 증가'] },
      { name: '소모품비', amount: 28, change: 1.0, details: ['사무용품 및 각종 소모품'] },
      { name: '기타 경비', amount: 19, change: 0.5, details: ['잡비 및 기타'] }
    ]
  }
];

const productImpact = [
  { product: 'HBM', value: 45.3, color: '#3b82f6', growth: 8.9 },
  { product: 'SRAM', value: 22.3, color: '#8b5cf6', growth: 5.5 },
  { product: 'CAL', value: 14.4, color: '#ec4899', growth: 9.9 },
  { product: 'DDR', value: 13.2, color: '#f59e0b', growth: 4.8 },
  { product: 'DRAM', value: 4.6, color: '#10b981', growth: 1.4 },
  { product: 'CIS', value: 3.4, color: '#06b6d4', growth: 2.1 },
  { product: 'PC DRAM', value: -12.1, color: '#64748b', growth: -4.5 },
  { product: 'NAND', value: -20.4, color: '#ef4444', growth: -9.6 }
];

const allocationDrivers = [
  { driver: '설비 가동시간', current: 125800, previous: 118400, unit: '시간' },
  { driver: '생산 수량', current: 45600, previous: 43200, unit: 'K Units' },
  { driver: '전력 사용량', current: 89400, previous: 85600, unit: 'MWh' },
  { driver: '면적', current: 15200, previous: 15200, unit: 'm²' },
  { driver: '인원', current: 2340, previous: 2280, unit: '명' }
];

const radarData = [
  { subject: '재료비', current: 112, previous: 98, fullMark: 150 },
  { subject: '노무비', current: 125, previous: 115, fullMark: 150 },
  { subject: '경비', current: 98, previous: 85, fullMark: 150 },
  { subject: '감가상각', current: 142, previous: 110, fullMark: 150 },
  { subject: '전력비', current: 95, previous: 88, fullMark: 150 }
];

export function MainDashboard() {
  const [selectedView, setSelectedView] = useState<'overview' | 'process' | 'product' | 'drivers' | 'network'>('overview');
  const [timeRange, setTimeRange] = useState('month');

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <motion.div 
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-72 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 shadow-2xl overflow-y-auto"
      >
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">원가 차이분석</h1>
          <p className="text-slate-400 text-sm">Semiconductor Cost Variance</p>
        </div>

        {/* Period Selector */}
        <div className="mb-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <div className="text-xs text-slate-400 mb-2">분석 기간</div>
          <div className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>2025.01 vs 2024.12</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['month', 'quarter', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  timeRange === range 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {range === 'month' ? '월간' : range === 'quarter' ? '분기' : '연간'}
              </button>
            ))}
          </div>
        </div>

        {/* View Navigation */}
        <nav className="space-y-2 mb-8">
          {[
            { id: 'overview', label: '전체 차이분석 개요', icon: Activity },
            { id: 'process', label: '공정별 차이분석', icon: Layers },
            { id: 'product', label: '제품별 차이분석', icon: DollarSign },
            { id: 'drivers', label: '원가 배부기준 변동', icon: Zap },
            { id: 'network', label: '원인 네트워크 분석', icon: Network }
          ].map((view) => {
            const Icon = view.icon;
            return (
              <motion.button
                key={view.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedView(view.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  selectedView === view.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{view.label}</span>
                {selectedView === view.id && <ChevronRight className="w-4 h-4 ml-auto" />}
              </motion.button>
            );
          })}
        </nav>

        {/* Quick Stats */}
        <div className="space-y-3">
          <div className="text-xs text-slate-400 mb-2">빠른 통계</div>
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-300">총 증가액</span>
            </div>
            <div className="text-xl font-bold text-red-400">+64.1억원</div>
          </div>
          
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-blue-300">주요 원인</span>
            </div>
            <div className="text-sm font-semibold text-blue-300">감가상각 +28.5억</div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header Bar */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="제품, 공정, 계정 검색..." 
                  className="pl-10 w-80 bg-slate-50 border-slate-200"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                필터
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                새로고침
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                보고서 출력
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8">
          <AnimatePresence mode="wait">
            {selectedView === 'overview' && <OverviewView costBreakdown={costBreakdown} />}
            {selectedView === 'process' && <ProcessView data={processData} />}
            {selectedView === 'product' && <ProductView data={productImpact} />}
            {selectedView === 'drivers' && <DriversView data={allocationDrivers} />}
            {selectedView === 'network' && <NetworkView />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Overview View with Drilldown
function OverviewView({ costBreakdown }: { costBreakdown: typeof costBreakdown }) {
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

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
            <div className="text-3xl font-bold mb-1">2,227억</div>
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
            <div className="text-3xl font-bold mb-1">2,162억</div>
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
            <div className="text-3xl font-bold mb-1">+64.1억</div>
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
            <div className="text-3xl font-bold mb-1">+3.0%</div>
            <div className="text-orange-100 text-sm">증감률</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Trend Line */}
        <Card className="col-span-2 shadow-lg border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">원가 추이</h3>
                <p className="text-sm text-slate-500">최근 6개월 월별 추이 분석</p>
              </div>
              <Badge variant="outline" className="gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                목표 초과
              </Badge>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Area type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                <Line type="monotone" dataKey="target" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </AreaChart>
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
                  {costBreakdown.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'][index]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => `${value}%`}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cost Element Breakdown with Drilldown */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">원가요소별 증감 상세 (차이 큰 순)</h3>
            <p className="text-sm text-slate-500">클릭하여 세부 계정 확인 가능</p>
          </div>
          
          <div className="space-y-3">
            {costBreakdown
              .sort((a, b) => b.change - a.change)
              .map((item, index) => (
              <div key={item.category}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setExpandedAccount(expandedAccount === item.category ? null : item.category)}
                  className="p-5 bg-gradient-to-r from-slate-50 to-white rounded-xl border-2 border-slate-200 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'][costBreakdown.indexOf(item)] }}
                      />
                      <span className="font-semibold text-slate-900">{item.category}</span>
                      <motion.div
                        animate={{ rotate: expandedAccount === item.category ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      </motion.div>
                    </div>
                    <Badge 
                      variant={item.change > 0 ? 'destructive' : 'default'}
                      className={item.change > 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}
                    >
                      {item.change > 0 ? '+' : ''}{item.change}억
                    </Badge>
                  </div>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">{item.amount}억</div>
                      <div className="text-xs text-slate-500">전체의 {item.percent}%</div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-lg font-bold ${item.change > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {item.change > 0 ? '+' : ''}{((item.change / (item.amount - item.change)) * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-500">전월 대비</div>
                    </div>
                  </div>
                </motion.div>

                {/* Drilldown - Sub Accounts */}
                <AnimatePresence>
                  {expandedAccount === item.category && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="ml-6 mt-2 space-y-2 overflow-hidden"
                    >
                      {item.subAccounts?.map((sub, subIdx) => (
                        <motion.div
                          key={sub.name}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: subIdx * 0.1 }}
                          className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-slate-700">{sub.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-600">{sub.amount}억</span>
                              <Badge className={`${sub.change > 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                {sub.change > 0 ? '+' : ''}{sub.change}억
                              </Badge>
                            </div>
                          </div>
                          <div className="ml-6 space-y-1">
                            {sub.details.map((detail, detailIdx) => (
                              <div key={detailIdx} className="text-xs text-slate-500 flex items-center gap-2">
                                <div className="w-1 h-1 bg-slate-400 rounded-full" />
                                {detail}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
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
            <RadarChart data={radarData}>
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
                  borderRadius: '8px'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Process View with expandable nodes
function ProcessView({ data }: { data: typeof processData }) {
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  
  // Sort by variance (descending)
  const sortedData = [...data].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">공정별 원가 분석</h2>
          <p className="text-slate-500">공정 클릭 시 재노경감 요소별 세부 분석</p>
        </div>
        <div className="flex gap-3">
          <Badge className="bg-blue-100 text-blue-700 px-4 py-2">전공정 (7개)</Badge>
          <Badge className="bg-purple-100 text-purple-700 px-4 py-2">후공정 (3개)</Badge>
        </div>
      </div>

      {/* Process Flow with Expandable Nodes */}
      <div className="space-y-4">
        {sortedData.map((process, idx) => {
          const isExpanded = selectedProcess === process.process;
          const isIncrease = process.variance > 0;
          
          return (
            <div key={process.process}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card 
                  className={`shadow-lg border-2 transition-all cursor-pointer ${
                    isExpanded ? 'border-blue-500 shadow-xl' : 'border-slate-200 hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedProcess(isExpanded ? null : process.process)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-xl ${
                          process.frontend > 0 ? 'bg-blue-100' : 'bg-purple-100'
                        }`}>
                          {process.frontend > 0 ? (
                            <Cpu className="w-8 h-8 text-blue-600" />
                          ) : (
                            <Package className="w-8 h-8 text-purple-600" />
                          )}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-900">{process.process}</h3>
                            <Badge className={process.frontend > 0 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                              {process.frontend > 0 ? '전공정' : '후공정'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            총 원가: {process.frontend + process.backend}억원
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className={`text-3xl font-bold ${isIncrease ? 'text-red-600' : 'text-blue-600'}`}>
                            {isIncrease ? '+' : ''}{process.variance}억
                          </div>
                          <div className="text-sm text-slate-500">차이 #{idx + 1}</div>
                        </div>
                        
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ChevronDown className="w-6 h-6 text-slate-400" />
                        </motion.div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Expanded Cost Elements */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mt-4 ml-6 overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      {process.costElements
                        ?.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
                        .map((element, elIdx) => (
                        <motion.div
                          key={element.element}
                          initial={{ opacity: 0, scale: 0.95, x: -20 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          transition={{ delay: elIdx * 0.1 }}
                          className="p-5 bg-gradient-to-br from-white to-slate-50 rounded-xl border-2 border-slate-200 shadow-md hover:shadow-lg transition-shadow"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                element.element === '재료비' ? 'bg-purple-100' :
                                element.element === '감가상각비' ? 'bg-blue-100' :
                                element.element === '인건비' ? 'bg-green-100' :
                                'bg-orange-100'
                              }`}>
                                {element.element === '재료비' && <Package className="w-5 h-5 text-purple-600" />}
                                {element.element === '감가상각비' && <Factory className="w-5 h-5 text-blue-600" />}
                                {element.element === '인건비' && <Activity className="w-5 h-5 text-green-600" />}
                                {element.element === '전력비' && <Zap className="w-5 h-5 text-orange-600" />}
                              </div>
                              <span className="font-bold text-slate-900">{element.element}</span>
                            </div>
                            <Badge className={`${
                              element.variance > 0 ? 'bg-red-100 text-red-700' : 
                              element.variance < 0 ? 'bg-blue-100 text-blue-700' : 
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {element.variance > 0 ? '+' : ''}{element.variance}억
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <div className="text-xs text-slate-500 mb-1">전월</div>
                              <div className="text-lg font-bold text-slate-700">{element.previous}억</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500 mb-1">당월</div>
                              <div className="text-lg font-bold text-blue-700">{element.current}억</div>
                            </div>
                          </div>
                          
                          {element.details && element.details.length > 0 && (
                            <div className="pt-3 border-t border-slate-200">
                              <div className="text-xs font-semibold text-slate-600 mb-2">세부 내역:</div>
                              <div className="space-y-1">
                                {element.details.map((detail, detailIdx) => (
                                  <div key={detailIdx} className="text-xs text-slate-600 flex items-start gap-2">
                                    <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                                    <span>{detail}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Product View
function ProductView({ data }: { data: typeof productImpact }) {
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

      {/* Product Cards Grid */}
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
              <div 
                className="h-2" 
                style={{ backgroundColor: product.color }}
              />
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
                    <div className={`text-2xl font-bold ${
                      product.value > 0 ? 'text-red-600' : 'text-blue-600'
                    }`}>
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
                      <span className={`font-bold ${
                        product.growth > 0 ? 'text-red-600' : 'text-blue-600'
                      }`}>
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
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
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
  );
}

// Drivers View
function DriversView({ data }: { data: typeof allocationDrivers }) {
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

      {/* Driver Cards */}
      {data.map((driver, idx) => {
        const change = driver.current - driver.previous;
        const changePercent = ((change / driver.previous) * 100).toFixed(1);
        
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
                  
                  <Badge className="px-4 py-2 text-sm bg-blue-100 text-blue-700">
                    MES 연동
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">전월</div>
                    <div className="text-2xl font-bold text-slate-700">
                      {driver.previous.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{driver.unit}</div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                    <div className="text-xs text-blue-600 mb-1">당월</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {driver.current.toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">{driver.unit}</div>
                  </div>
                  
                  <div className={`p-4 rounded-lg ${
                    change > 0 ? 'bg-red-50 border-2 border-red-200' : 'bg-green-50 border-2 border-green-200'
                  }`}>
                    <div className={`text-xs mb-1 ${change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      변동
                    </div>
                    <div className="flex items-center gap-2">
                      {change > 0 ? (
                        <TrendingUp className="w-5 h-5 text-red-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-green-600" />
                      )}
                      <div className={`text-2xl font-bold ${
                        change > 0 ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {change > 0 ? '+' : ''}{changePercent}%
                      </div>
                    </div>
                  </div>
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
        );
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
              { system: 'MES', status: 'active', lastSync: '2분 전', records: '1,245건' },
              { system: 'PLM', status: 'active', lastSync: '5분 전', records: '834건' },
              { system: 'SAP ERP', status: 'active', lastSync: '1분 전', records: '2,891건' }
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
  );
}

// Network View
function NetworkView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <CostNetworkGraph />
    </motion.div>
  );
}