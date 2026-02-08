/**
 * API 서비스 - 백엔드 통신 모듈
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// ── 대시보드 API ──

export const dashboardApi = {
  getSummary: (yyyymm: string) =>
    api.get('/dashboard/summary', { params: { yyyymm } }),

  getByCostElement: (yyyymm: string) =>
    api.get('/dashboard/by-cost-element', { params: { yyyymm } }),

  getByProductGroup: (yyyymm: string) =>
    api.get('/dashboard/by-product-group', { params: { yyyymm } }),

  getByProduct: (yyyymm: string, productGrp?: string) =>
    api.get('/dashboard/by-product', { params: { yyyymm, product_grp: productGrp } }),

  getAllocAnalysis: (yyyymm: string, productCd: string, procCd: string, ceCd: string) =>
    api.get('/dashboard/alloc-analysis', {
      params: { yyyymm, product_cd: productCd, proc_cd: procCd, ce_cd: ceCd },
    }),

  getSourceEvents: (yyyymm: string, varId?: string) =>
    api.get('/dashboard/source-events', { params: { yyyymm, var_id: varId } }),

  getTopVariances: (yyyymm: string, limit = 20) =>
    api.get('/dashboard/top-variances', { params: { yyyymm, limit } }),

  getCausalAnalysis: (yyyymm: string, productCd: string) =>
    api.get('/dashboard/causal-analysis', { params: { yyyymm, product_cd: productCd } }),

  getGraphStats: () =>
    api.get('/dashboard/graph-stats'),

  getGraphData: (yyyymm: string, productCd: string) =>
    api.get('/dashboard/graph-data', { params: { yyyymm, product_cd: productCd } }),

  // ── 대시보드 뷰 전용 API ──

  getTrendByProductGroup: (yyyymm: string, months = 6) =>
    api.get('/dashboard/trend-by-product-group', { params: { yyyymm, months } }),

  getCostElementDrilldown: (yyyymm: string) =>
    api.get('/dashboard/cost-element-drilldown', { params: { yyyymm } }),

  getProcessSummary: (yyyymm: string) =>
    api.get('/dashboard/process-summary', { params: { yyyymm } }),

  getAllocSummary: (yyyymm: string) =>
    api.get('/dashboard/alloc-summary', { params: { yyyymm } }),
}

// ── 분석 API ──

export const analysisApi = {
  calculateVariance: (yyyymm: string) =>
    api.post('/analysis/calculate-variance', null, { params: { yyyymm } }),

  buildGraph: (yyyymm: string) =>
    api.post('/analysis/build-graph', null, { params: { yyyymm } }),

  runRules: (yyyymm: string) =>
    api.post('/analysis/run-rules', null, { params: { yyyymm } }),

  interpret: (yyyymm: string) =>
    api.post('/analysis/interpret', null, { params: { yyyymm } }),

  getCausalPath: (varId: string) =>
    api.get('/analysis/causal-path', { params: { var_id: varId } }),

  getSpreadAnalysis: (varId: string) =>
    api.get('/analysis/spread-analysis', { params: { var_id: varId } }),

  getEvidencePackage: (varId: string) =>
    api.get('/analysis/evidence-package', { params: { var_id: varId } }),
}

// ── 챗 API ──

export const chatApi = {
  ask: (question: string, yyyymm?: string) =>
    api.post('/chat/ask', { question, yyyymm }),
}

// ── 보고서 API ──

export const reportApi = {
  executiveSummary: (yyyymm: string) =>
    api.get('/report/executive-summary', { params: { yyyymm } }),

  costTeam: (yyyymm: string) =>
    api.get('/report/cost-team', { params: { yyyymm } }),

  productionTeam: (yyyymm: string) =>
    api.get('/report/production-team', { params: { yyyymm } }),

  purchaseTeam: (yyyymm: string) =>
    api.get('/report/purchase-team', { params: { yyyymm } }),
}

export default api
