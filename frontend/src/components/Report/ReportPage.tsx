import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { reportApi } from '../../services/api'

/* ── 비즈니스 관점 차이유형 라벨 ── */
const CE_NAMES: Record<string, string> = {
  CE_DEP: '감가상각비', CE_LAB: '인건비', CE_PWR: '전력비',
  CE_MAT: '재료비', CE_MNT: '수선유지비', CE_GAS: '기료비', CE_OTH: '기타경비',
}
const getVarLabel = (varType: string, ceCd?: string): string => {
  const ceName = ceCd ? (CE_NAMES[ceCd] || ceCd) : ''
  switch (varType) {
    case 'RATE_VAR':  return '단위원가 변동'
    case 'QTY_VAR':   return '생산Mix 변동'
    case 'RATE_COST': return `${ceName} 총액 증감`
    case 'RATE_BASE': return '가동시간 변동'
    case 'PRICE_VAR': return '자재 단가 변동'
    case 'USAGE_VAR': return 'BOM 사용량 변동'
    default: return varType
  }
}

/* ── 경영진 보고서 ── */
function ExecutiveReport({ data }: { data: any }) {
  const tc = data.total_cost
  const diff = (tc.curr || 0) - (tc.prev || 0)
  const rate = tc.prev ? (diff / tc.prev * 100) : 0

  return (
    <>
      {/* 총원가 요약 */}
      <div className="report-summary-bar">
        <div className="report-summary-item">
          <span className="report-summary-label">당월 총원가</span>
          <span className="report-summary-value">{tc.curr?.toFixed(1)} 억원</span>
        </div>
        <div className="report-summary-arrow">{diff >= 0 ? '▲' : '▼'}</div>
        <div className="report-summary-item">
          <span className="report-summary-label">전월 총원가</span>
          <span className="report-summary-value">{tc.prev?.toFixed(1)} 억원</span>
        </div>
        <div className="report-summary-item">
          <span className="report-summary-label">증감</span>
          <span className={`report-summary-value ${diff >= 0 ? 'text-positive' : 'text-negative'}`}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(1)} 억원 ({rate >= 0 ? '+' : ''}{rate.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* 제품군별 증감 */}
      <div className="card">
        <h3 className="card-title">제품군별 원가 증감</h3>
        {data.by_product_group?.length > 0 && (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.by_product_group}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="product_grp" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}억원`} />
              <Bar dataKey="diff" name="증감(억원)" radius={[4, 4, 0, 0]}>
                {data.by_product_group.map((d: any, i: number) => (
                  <Cell key={i} fill={d.diff >= 0 ? '#ef4444' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>제품군</th>
              <th style={{ textAlign: 'right' }}>당월 (억원)</th>
              <th style={{ textAlign: 'right' }}>전월 (억원)</th>
              <th style={{ textAlign: 'right' }}>증감 (억원)</th>
              <th style={{ textAlign: 'right' }}>증감률</th>
            </tr>
          </thead>
          <tbody>
            {data.by_product_group?.map((g: any) => (
              <tr key={g.product_grp}>
                <td><strong>{g.product_grp}</strong></td>
                <td style={{ textAlign: 'right' }}>{g.curr?.toFixed(1)}</td>
                <td style={{ textAlign: 'right' }}>{g.prev?.toFixed(1)}</td>
                <td style={{ textAlign: 'right' }} className={g.diff >= 0 ? 'text-positive' : 'text-negative'}>
                  {g.diff >= 0 ? '+' : ''}{g.diff?.toFixed(1)}
                </td>
                <td style={{ textAlign: 'right' }} className={g.rate >= 0 ? 'text-positive' : 'text-negative'}>
                  {g.rate >= 0 ? '+' : ''}{g.rate?.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ── 원가팀 보고서 ── */
function CostTeamReport({ data }: { data: any }) {
  const grouped = (data.top_variances || []).reduce((acc: any, v: any) => {
    const key = `${v.product_cd}_${v.proc_cd}_${v.ce_cd}`
    if (!acc[key]) acc[key] = { ...v, items: [] }
    acc[key].items.push(v)
    return acc
  }, {} as Record<string, any>)

  return (
    <div className="card">
      <h3 className="card-title">주요 차이 항목 (금액 기준 상위)</h3>
      <table>
        <thead>
          <tr>
            <th>제품군</th>
            <th>제품코드</th>
            <th>공정</th>
            <th>원가요소</th>
            <th>차이유형</th>
            <th style={{ textAlign: 'right' }}>금액 (억원)</th>
            <th style={{ textAlign: 'right' }}>변동률</th>
          </tr>
        </thead>
        <tbody>
          {data.top_variances?.map((v: any, i: number) => (
            <tr key={i}>
              <td>{v.product_grp}</td>
              <td><strong>{v.product_cd}</strong></td>
              <td>{v.proc_cd}</td>
              <td>{v.ce_cd}</td>
              <td>
                <span className={`badge ${
                  v.var_type.includes('RATE') ? 'badge-info' :
                  v.var_type.includes('PRICE') ? 'badge-warning' : 'badge-success'
                }`}>
                  {getVarLabel(v.var_type, v.ce_cd)}
                </span>
              </td>
              <td style={{ textAlign: 'right' }} className={v.var_amt >= 0 ? 'text-positive' : 'text-negative'}>
                {v.var_amt >= 0 ? '+' : ''}{v.var_amt?.toFixed(2)}
              </td>
              <td style={{ textAlign: 'right' }} className={v.var_rate >= 0 ? 'text-positive' : 'text-negative'}>
                {v.var_rate >= 0 ? '+' : ''}{(v.var_rate * 100)?.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── 생산팀 보고서 ── */
function ProductionTeamReport({ data }: { data: any }) {
  return (
    <>
      <div className="card">
        <h3 className="card-title">MES 이벤트 — 장비 가동률/수율 변동</h3>
        <table>
          <thead>
            <tr>
              <th>장비코드</th>
              <th>장비명</th>
              <th>지표</th>
              <th style={{ textAlign: 'right' }}>전월</th>
              <th style={{ textAlign: 'right' }}>당월</th>
              <th style={{ textAlign: 'right' }}>변동</th>
              <th style={{ textAlign: 'right' }}>변동률</th>
            </tr>
          </thead>
          <tbody>
            {data.mes_events?.map((e: any, i: number) => (
              <tr key={i}>
                <td><strong>{e.equip_cd}</strong></td>
                <td>{e.equip_nm}</td>
                <td><span className="badge badge-info">{e.metric_type}</span></td>
                <td style={{ textAlign: 'right' }}>{e.prev_value}</td>
                <td style={{ textAlign: 'right' }}>{e.curr_value}</td>
                <td style={{ textAlign: 'right' }} className={e.chg_value >= 0 ? 'text-positive' : 'text-negative'}>
                  {e.chg_value >= 0 ? '+' : ''}{e.chg_value}
                </td>
                <td style={{ textAlign: 'right' }} className={e.chg_rate >= 0 ? 'text-positive' : 'text-negative'}>
                  {(e.chg_rate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.cost_impacts?.length > 0 && (
        <div className="card">
          <h3 className="card-title">원가 영향 분석 (Neo4j EVIDENCED_BY 연결)</h3>
          <table>
            <thead>
              <tr>
                <th>장비</th>
                <th>제품</th>
                <th>차이유형</th>
                <th style={{ textAlign: 'right' }}>영향 금액 (억원)</th>
                <th style={{ textAlign: 'right' }}>영향률</th>
              </tr>
            </thead>
            <tbody>
              {data.cost_impacts.map((c: any, i: number) => (
                <tr key={i}>
                  <td>{c.equipment}</td>
                  <td><strong>{c.product}</strong></td>
                  <td><span className="badge badge-info">{getVarLabel(c.var_type, c.ce_cd)}</span></td>
                  <td style={{ textAlign: 'right' }} className="text-positive">
                    {c.var_amt >= 0 ? '+' : ''}{c.var_amt?.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right' }} className="text-positive">
                    {(c.var_rate * 100)?.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/* ── 구매팀 보고서 ── */
function PurchaseTeamReport({ data }: { data: any }) {
  return (
    <>
      <div className="card">
        <h3 className="card-title">자재 단가 변동 이벤트</h3>
        <table>
          <thead>
            <tr>
              <th>자재코드</th>
              <th>자재명</th>
              <th>변경유형</th>
              <th style={{ textAlign: 'right' }}>변경 전</th>
              <th style={{ textAlign: 'right' }}>변경 후</th>
              <th style={{ textAlign: 'right' }}>변동률</th>
              <th>사유</th>
            </tr>
          </thead>
          <tbody>
            {data.purchase_events?.map((e: any, i: number) => (
              <tr key={i}>
                <td><strong>{e.mat_cd}</strong></td>
                <td>{e.mat_nm}</td>
                <td><span className="badge badge-warning">{e.chg_type}</span></td>
                <td style={{ textAlign: 'right' }}>{e.prev_value?.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{e.curr_value?.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }} className="text-positive">
                  +{(e.chg_rate * 100).toFixed(1)}%
                </td>
                <td>{e.chg_reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.cost_impacts?.length > 0 && (
        <div className="card">
          <h3 className="card-title">원가 영향 분석 (Neo4j EVIDENCED_BY 연결)</h3>
          <table>
            <thead>
              <tr>
                <th>자재</th>
                <th>제품</th>
                <th>차이유형</th>
                <th style={{ textAlign: 'right' }}>영향 금액 (억원)</th>
                <th style={{ textAlign: 'right' }}>영향률</th>
              </tr>
            </thead>
            <tbody>
              {data.cost_impacts.map((c: any, i: number) => (
                <tr key={i}>
                  <td>{c.material}</td>
                  <td><strong>{c.product}</strong></td>
                  <td>
                    <span className="badge badge-warning">
                      {getVarLabel(c.var_type, c.ce_cd)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }} className="text-positive">
                    +{c.var_amt?.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right' }} className="text-positive">
                    +{(c.var_rate * 100)?.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/* ── 메인 보고서 페이지 ── */
const reportConfig: Record<string, {
  title: string; subtitle: string
  fetchFn: (ym: string) => Promise<any>
  Component: React.FC<{ data: any }>
}> = {
  executive: {
    title: '경영진 요약 보고서',
    subtitle: '제품군별 원가 증감 + 핵심 원인 요약',
    fetchFn: (ym) => reportApi.executiveSummary(ym).then(r => r.data),
    Component: ExecutiveReport,
  },
  'cost-team': {
    title: '원가팀 상세 보고서',
    subtitle: '원가요소별 상세 Drill-down · 단위원가/생산Mix/단가/BOM 분해',
    fetchFn: (ym) => reportApi.costTeam(ym).then(r => r.data),
    Component: CostTeamReport,
  },
  'production-team': {
    title: '생산팀 보고서',
    subtitle: 'MES 장비 가동률/수율 변동 → 원가 영향 분석',
    fetchFn: (ym) => reportApi.productionTeam(ym).then(r => r.data),
    Component: ProductionTeamReport,
  },
  'purchase-team': {
    title: '구매팀 보고서',
    subtitle: '자재 단가 변동 → 원가 영향 분석',
    fetchFn: (ym) => reportApi.purchaseTeam(ym).then(r => r.data),
    Component: PurchaseTeamReport,
  },
}

export default function ReportPage() {
  const { type } = useParams<{ type: string }>()
  const [yyyymm, setYyyymm] = useState('202501')
  const config = reportConfig[type || 'executive']

  const { data, isLoading } = useQuery({
    queryKey: ['report', type, yyyymm],
    queryFn: () => config?.fetchFn(yyyymm),
    enabled: !!config,
  })

  if (!config) return <div className="card">보고서를 찾을 수 없습니다.</div>

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{config.title}</h2>
        <p className="page-subtitle">{config.subtitle}</p>
      </div>

      <div className="month-selector">
        <label>기준월:</label>
        <select value={yyyymm} onChange={e => setYyyymm(e.target.value)}>
          <option value="202501">2025년 01월</option>
          <option value="202412">2024년 12월</option>
        </select>
        <span className="report-badge">
          {yyyymm.slice(0, 4)}년 {parseInt(yyyymm.slice(4))}월 보고서
        </span>
      </div>

      {isLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div className="spinner" />
          <p style={{ marginTop: 12 }}>보고서를 생성하고 있습니다...</p>
        </div>
      ) : data ? (
        <config.Component data={data} />
      ) : null}
    </div>
  )
}
