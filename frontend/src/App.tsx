import { useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import DashboardPage from './components/Dashboard/DashboardPage'
import GraphExplorer from './components/Graph/GraphExplorer'
import AnalysisPage from './components/Analysis/AnalysisPage'
import ChatPage from './components/Chat/ChatPage'
import ReportPage from './components/Report/ReportPage'
import { motion } from 'motion/react'
import {
  Activity,
  Layers,
  DollarSign,
  Zap,
  Network,
  TrendingUp,
  AlertCircle,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Download,
  ChevronRight,
  BarChart3,
  MessageSquare,
  Play,
  FileText,
  Users,
  Factory,
  ShoppingCart,
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'

type DashboardView = 'overview' | 'process' | 'product' | 'drivers' | 'network'

function App() {
  const [dashboardView, setDashboardView] = useState<DashboardView>('overview')
  const [timeRange, setTimeRange] = useState('month')
  const location = useLocation()
  const isDashboard = location.pathname === '/'

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-72 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 shadow-2xl overflow-y-auto flex-shrink-0"
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

        {/* Dashboard Views */}
        <div className="mb-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-2">대시보드</div>
          <nav className="space-y-1">
            {[
              { id: 'overview' as DashboardView, label: '전체 차이분석 개요', icon: Activity },
              { id: 'process' as DashboardView, label: '공정별 차이분석', icon: Layers },
              { id: 'product' as DashboardView, label: '제품별 차이분석', icon: DollarSign },
              { id: 'drivers' as DashboardView, label: '원가 배부기준 변동', icon: Zap },
              { id: 'network' as DashboardView, label: '원인 네트워크 분석', icon: Network },
            ].map((view) => {
              const Icon = view.icon
              const isActive = isDashboard && dashboardView === view.id
              return (
                <NavLink
                  key={view.id}
                  to="/"
                  onClick={() => setDashboardView(view.id)}
                >
                  <motion.div
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{view.label}</span>
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </motion.div>
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Tools */}
        <div className="mb-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-2">분석 도구</div>
          <nav className="space-y-1">
            {[
              { to: '/graph', label: '그래프 탐색', icon: BarChart3 },
              { to: '/analysis', label: '분석 실행', icon: Play },
              { to: '/chat', label: '질의응답', icon: MessageSquare },
            ].map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to}>
                  {({ isActive }) => (
                    <motion.div
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                    </motion.div>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Reports */}
        <div className="mb-6">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-2">보고서</div>
          <nav className="space-y-1">
            {[
              { to: '/report/executive', label: '경영진 보고서', icon: FileText },
              { to: '/report/cost-team', label: '원가팀 보고서', icon: DollarSign },
              { to: '/report/production-team', label: '생산팀 보고서', icon: Factory },
              { to: '/report/purchase-team', label: '구매팀 보고서', icon: ShoppingCart },
            ].map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to}>
                  {({ isActive }) => (
                    <motion.div
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                    </motion.div>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Quick Stats */}
        <div className="space-y-3 mt-auto">
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
          <Routes>
            <Route path="/" element={<DashboardPage selectedView={dashboardView} />} />
            <Route path="/graph" element={<GraphExplorer />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/report/:type" element={<ReportPage />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default App
