import { useState } from 'react'
import { analysisApi } from '../../services/api'

export default function AnalysisPage() {
  const [yyyymm, setYyyymm] = useState('202501')
  const [status, setStatus] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const addStatus = (msg: string) => setStatus(prev => [...prev, msg])

  const runFullProcess = async () => {
    setLoading(true)
    setStatus([])

    try {
      // Step 3: 차이 계산
      addStatus('Step 3: 차이 계산 실행 중...')
      const calcResult = await analysisApi.calculateVariance(yyyymm)
      addStatus(`Step 3 완료: ${calcResult.data.count}건 생성`)

      // Step 4: 그래프 구축
      addStatus('Step 4: 그래프 구축 실행 중...')
      await analysisApi.buildGraph(yyyymm)
      addStatus('Step 4a~4c 완료: 그래프 노드 생성')

      // Step 4d: 인과관계
      addStatus('Step 4d: 인과관계 규칙 엔진 실행 중...')
      await analysisApi.runRules(yyyymm)
      addStatus('Step 4d 완료: 인과관계 연결')

      // Step 5: LLM 해석
      addStatus('Step 5: LLM 해석 생성 중...')
      const interpretResult = await analysisApi.interpret(yyyymm)
      addStatus(`Step 5 완료: ${interpretResult.data.count}건 해석`)

      addStatus('전체 프로세스 완료!')
    } catch (error: any) {
      addStatus(`오류 발생: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">분석 실행</h2>
        <p className="page-subtitle">월별 차이분석 프로세스 수동 실행</p>
      </div>

      <div className="card">
        <h3 className="card-title">월별 실행 프로세스</h3>
        <div className="month-selector">
          <label>기준월:</label>
          <select value={yyyymm} onChange={e => setYyyymm(e.target.value)}>
            <option value="202501">2025년 01월</option>
            <option value="202412">2024년 12월</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={runFullProcess}
            disabled={loading}
          >
            {loading ? '실행 중...' : '전체 프로세스 실행'}
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <h4>실행 로그</h4>
          <div style={{
            background: '#1e293b',
            color: '#94a3b8',
            padding: 16,
            borderRadius: 8,
            fontFamily: 'monospace',
            fontSize: 13,
            maxHeight: 400,
            overflowY: 'auto',
            marginTop: 8,
          }}>
            {status.length === 0 ? (
              <div style={{ color: '#64748b' }}>실행 로그가 여기에 표시됩니다...</div>
            ) : (
              status.map((msg, i) => (
                <div key={i} style={{
                  color: msg.includes('완료') ? '#4ade80' :
                         msg.includes('오류') ? '#f87171' : '#94a3b8'
                }}>
                  [{new Date().toLocaleTimeString()}] {msg}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">프로세스 단계</h3>
        <table>
          <thead>
            <tr>
              <th>단계</th>
              <th>설명</th>
              <th>세부 내용</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Step 1-2</td><td>데이터 적재</td><td>SAP/MES/PLM/구매 데이터 (프로토타입: 샘플데이터)</td></tr>
            <tr><td>Step 3</td><td>차이 계산</td><td>전공정 배부분해, 후공정 재료비/가공비 분해</td></tr>
            <tr><td>Step 4a</td><td>상설 그래프</td><td>제품/공정/장비/자재 노드 및 관계 갱신</td></tr>
            <tr><td>Step 4b</td><td>차이 노드</td><td>계층적 차이 노드 생성 (제품군/제품코드)</td></tr>
            <tr><td>Step 4c</td><td>이벤트 노드</td><td>MES/PLM/구매 이벤트 노드 생성</td></tr>
            <tr><td>Step 4d</td><td>인과관계</td><td>Rule 1~6 규칙 기반 자동 연결</td></tr>
            <tr><td>Step 5</td><td>LLM 해석</td><td>증거 기반 자동 해석 코멘트 생성</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
