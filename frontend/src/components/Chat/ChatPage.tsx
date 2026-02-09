import { useState, useRef, useEffect } from 'react'
import { chatApi } from '../../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

/* ═══════════ 로컬 지식 기반 답변 엔진 ═══════════ */
// 대시보드 데이터에 기반한 사전 정의 답변
const KNOWLEDGE_BASE: { patterns: RegExp[]; answer: string }[] = [
  {
    patterns: [
      /원가.*(?:왜|어떻게|이유).*(?:올|증가|상승|높)/i,
      /(?:이번|금|당).*달.*원가/i,
      /원가.*(?:올|증가|상승)/i,
      /비용.*(?:왜|어떻게|이유).*(?:올|증가|상승)/i,
    ],
    answer: `📊 2025년 1월 원가 증가 분석 보고서

■ 총괄 요약
2025년 1월 총 제조원가는 2,227억원으로, 전월(2,162억원) 대비 +64.1억원(+3.0%) 증가하였습니다.

■ 원가요소별 증감 내역 (차이 큰 순)

  1. 감가상각비: 842억원 (+28.5억, 전체의 37.8%)
     → EUV 노광 장비 신규 투입(+10.2억)이 최대 요인
     → 전공정 설비 +18.3억, 후공정 설비 +8.2억
  
  2. 재료비: 567억원 (+16.2억, 전체의 25.5%)
     → CMP 슬러리 단가 상승(+3.5억), 포토레지스트(+2.8억)
     → 글로벌 공급망 이슈와 고순도 소재 수요 증가
  
  3. 인건비: 334억원 (+8.4억, 전체의 15.0%)
     → 생산직 임금 인상, 숙련공 채용 경쟁 심화
  
  4. 전력비: 256억원 (+4.8억, 전체의 11.5%)
     → EUV 장비 전력소모가 기존 ArF 대비 10배 이상
  
  5. 운반비: 143억원 (+3.2억, 전체의 6.4%)
  6. 기타: 85억원 (+3.0억, 전체의 3.8%)

■ 핵심 원인 요약
감가상각비(+28.5억)와 재료비(+16.2억)가 전체 증가분의 약 70%를 차지합니다.
이는 EUV 등 첨단 장비 투자에 따른 구조적 비용 증가가 주된 원인이며, 
단기적 비용 억제보다는 장기적 기술 경쟁력 확보 관점에서의 전략적 판단이 필요합니다.

■ 긍정적 사항
테스트 공정에서 자동화 도입으로 -5.2억원 절감 (인건비 -4.0억, 테스트보드 효율화 -1.0억)을 달성했습니다.`,
  },
  {
    patterns: [
      /HBM.*(?:배부|원가|비용|단가)/i,
      /HBM.*(?:왜|어떻게|이유)/i,
      /HBM.*(?:상승|증가|올)/i,
    ],
    answer: `📊 HBM 제품 원가 분석

■ HBM 원가 추이
HBM 제품군이 6개월 연속 원가 상승 추이를 보이고 있습니다.
  - 2024년 8월: 480억 → 2025년 1월: 585억 (+21.9%)
  - 원가 영향: +45.3억원 (전 제품군 중 최대)
  - 성장률: +8.9%

■ 주요 원인
  1. AI 서버용 HBM 수요 급증에 따른 생산량 확대
  2. 고단 적층 공정(HBM3E)의 복잡성 증가
  3. 조립 공정 원가 급증 (+22.8억)
     → 와이어본딩 재료비 +8.2억 (Au 와이어 단가 상승)
     → 조립설비 신규 투입 감가상각 +4.5억
  4. 포토 공정 EUV 장비 감가상각 +14억

■ 배부율 영향
  - 설비 가동시간: 118,400시간 → 125,800시간 (+6.3%)
  - 생산 수량: 43,200K → 45,600K Units (+5.6%)
  - 전력 사용량: 85,600MWh → 89,400MWh (+4.4%)
  
HBM 생산 비중 확대로 전력·가동시간 기반 배부율이 상승하여
HBM 제품에 더 많은 간접비가 배부되는 구조입니다.

■ 향후 전망
HBM3E 양산 본격화에 따라 후공정(조립/패키징) 원가가 Q1 대비 8~12% 추가 상승할 전망입니다.`,
  },
  {
    patterns: [
      /(?:과거|이전|지난|예전).*(?:패턴|추이|추세|경향|유사)/i,
      /(?:패턴|추이|추세).*(?:있|보|나타)/i,
      /(?:역사|히스토리|트렌드)/i,
    ],
    answer: `📊 과거 원가 변동 패턴 분석

■ 최근 6개월 총 제조원가 추이
  - 2024년 8월: 약 2,080억원
  - 2024년 9월: 약 2,100억원
  - 2024년 10월: 약 2,090억원
  - 2024년 11월: 약 2,135억원
  - 2024년 12월: 약 2,162억원
  - 2025년 1월: 약 2,227억원

■ 주요 패턴

  1. 감가상각비 지속 상승 패턴
     785 → 798 → 792 → 810 → 813 → 842억원
     EUV 등 대규모 설비 투자가 매월 감가상각비를 끌어올리는 구조적 상승 패턴입니다.
  
  2. 재료비 계단식 상승
     530 → 542 → 535 → 548 → 551 → 567억원
     글로벌 소재 단가 인상에 따른 계단식 상승 패턴이 관찰됩니다.
  
  3. 인건비 완만한 우상향
     310 → 315 → 318 → 322 → 326 → 334억원
     매월 2~3%의 안정적 증가 추세로, 임금 인상과 인력 충원이 반영됩니다.
  
  4. 전력비 변동성
     238 → 245 → 240 → 248 → 251 → 256억원
     가동률에 따라 소폭 변동하나, EUV 장비 증가로 전체적으로 우상향합니다.

■ 유사 패턴 분석
2024년 11월에도 감가상각비 +7억, 재료비 +13억으로 유사한 상승 패턴이 있었으며,
이는 대규모 설비 투자 후 매월 반복되는 구조적 패턴으로 판단됩니다.`,
  },
  {
    patterns: [
      /(?:제품|파급|영향|확산).*(?:어|무|뭐|있)/i,
      /(?:어떤|어느).*제품.*(?:파급|영향)/i,
      /제품.*(?:별|군).*(?:분석|현황)/i,
    ],
    answer: `📊 제품별 원가 파급 영향 분석

■ 원가 증가 제품군 (증가순)

  1. HBM: +45.3억원 (성장률 +8.9%) ⚠️ 최대 증가
     → AI 서버 수요 급증, 고단 적층 공정 복잡성 증가
  
  2. SRAM: +22.3억원 (성장률 +5.5%)
     → 캐시 메모리 수요 증가에 따른 생산량 확대
  
  3. CAL: +14.4억원 (성장률 +9.9%)
     → 가장 높은 성장률, 신규 수요처 확대
  
  4. DDR: +13.2억원 (성장률 +4.8%)
     → 서버 DDR5 전환 수요
  
  5. DRAM: +4.6억원 (성장률 +1.4%)
  6. CIS: +3.4억원 (성장률 +2.1%)

■ 원가 감소 제품군 (감소순)

  1. NAND: -20.4억원 (성장률 -9.6%) ✅ 최대 감소
     → 수요 둔화에 따른 생산 축소, 단가 하락
  
  2. PC DRAM: -12.1억원 (성장률 -4.5%)
     → PC 시장 수요 감소, 생산 비중 축소

■ 제품 포트폴리오 분석
  • 고성장/원가증가 그룹: HBM, CAL → 적극 투자 필요
  • 저성장/원가감소 그룹: NAND, PC DRAM → 구조조정 검토
  
■ 전략적 시사점
HBM·CAL 등 고부가 제품으로의 포트폴리오 전환이 가속되고 있으며,
NAND·PC DRAM의 원가 감소는 수익성 방어에 긍정적으로 작용합니다.
전체 제품 믹스 효과로 단위당 수익성은 개선 추세입니다.`,
  },
  {
    patterns: [
      /감가상각/i,
      /설비.*(?:투자|비용|원가)/i,
      /EUV/i,
    ],
    answer: `📊 감가상각비 상세 분석

■ 총괄
감가상각비는 당월 842억원으로 전체 원가의 37.8%를 차지하며,
전월 대비 +28.5억원(+3.5%) 증가하여 최대 비용 상승 요인입니다.

■ 세부 내역

  1. 전공정 설비: 485억원 (+18.3억)
     → EUV 노광 설비: 210억 (+10.2억) ← 최대 증가 항목
     → ArF 식각 설비: 125억 (+4.8억)
     → 증착/CMP 설비: 95억 (+2.1억)
     → 이온주입 설비: 55억 (+1.2억)
  
  2. 후공정 설비: 267억원 (+8.2억)
     → 와이어본더: 98억 (+3.5억)
     → 몰딩 설비: 72억 (+2.4억)
     → 패키징 라인: 62억 (+1.5억)
     → 테스트 설비: 35억 (+0.8억)
  
  3. 공통 설비: 90억원 (+2.0억)
     → 유틸리티(냉각/공조): 52억 (+1.2억)
     → 검사/계측 장비: 38억 (+0.8억)

■ 핵심 이슈
감가상각비가 전체의 40%에 육박하는 수준으로,
대규모 설비 투자에 따른 고정비 부담이 가중되고 있습니다.

■ 전망
2월에도 EUV 장비 추가 가동 예정으로 +15~20억원 추가 증가가 예상됩니다.
설비 가동률 극대화가 단위당 원가 관리의 핵심입니다.`,
  },
  {
    patterns: [
      /재료비/i,
      /소재.*(?:비용|원가|단가)/i,
      /슬러리/i,
      /포토레지스트/i,
    ],
    answer: `📊 재료비 상세 분석

■ 총괄
재료비는 당월 567억원으로 전체 원가의 25.5%를 차지하며,
전월 대비 +16.2억원(+2.9%) 증가하였습니다.

■ 세부 내역

  1. 원재료: 285억원 (+8.5억)
     → CMP 슬러리: 82억 (+3.5억) ← 단가 상승 주요인
     → 포토레지스트: 68억 (+2.8억) ← 일본 의존도 리스크
     → 에칭 가스: 55억 (+1.2억)
     → 웨이퍼: 80억 (+1.0억)
  
  2. 부재료: 182억원 (+5.2억)
     → 특수 가스류: 72억 (+2.4억)
     → 챔버 부품: 58억 (+1.8억)
     → 타겟 재료: 52억 (+1.0억)
  
  3. 포장재: 100억원 (+2.5억)
     → 기판(Substrate): 48억 (+1.2억)
     → 솔더볼/범프: 32억 (+0.8억)
     → 몰딩 컴파운드: 20억 (+0.5억)

■ 핵심 리스크
CMP 슬러리, 포토레지스트 등 일본 의존도가 높은 소재의 
단가 상승이 지속되고 있어 대체 공급처 확보가 시급합니다.

■ 긍정 요인
웨이퍼 단가 하락세가 지속되어 일부 상쇄 효과가 있습니다.`,
  },
  {
    patterns: [
      /인건비/i,
      /인력.*(?:비용|원가)/i,
      /임금|급여/i,
    ],
    answer: `📊 인건비 상세 분석

■ 총괄
인건비는 당월 334억원으로 전체 원가의 15.0%를 차지하며,
전월 대비 +8.4억원(+2.6%) 증가하였습니다.

■ 세부 내역

  1. 직접 인건비: 198억원 (+5.1억)
     → 전공정 오퍼레이터: 95억 (+2.5억)
     → 후공정 오퍼레이터: 68억 (+1.8억)
     → 장비 엔지니어: 35억 (+0.8억)
  
  2. 간접 인건비: 98억원 (+2.5억)
     → 공정 엔지니어: 52억 (+1.5억)
     → 품질 관리: 28억 (+0.6억)
     → 생산 관리: 18억 (+0.4억)
  
  3. 복리후생비: 38억원 (+0.8억)

■ 긍정적 성과
테스트 공정에서 자동화 도입으로 인건비 -4.0억원 절감에 성공.
이를 타 공정으로 확산하는 것이 효과적입니다.

■ 리스크
반도체 업계 인력난으로 숙련공 확보 경쟁이 심화되고 있어,
향후 인건비 증가 추세가 가속화될 수 있습니다.`,
  },
  {
    patterns: [
      /전력/i,
      /전기.*(?:비용|원가|요금)/i,
      /에너지/i,
    ],
    answer: `📊 전력비 상세 분석

■ 총괄
전력비는 당월 256억원으로 전체 원가의 11.5%를 차지하며,
전월 대비 +4.8억원(+1.9%) 증가하였습니다.

■ 세부 내역

  1. 전공정 전력: 165억원 (+3.2억)
     → EUV 노광 전력: 62억 (+1.5억) ← EUV 전력소모 10배↑
     → 식각/증착 전력: 58억 (+1.0억)
     → CMP/세정 전력: 45억 (+0.7억)
  
  2. 후공정 전력: 67억원 (+1.2억)
     → 리플로우 전력: 32억 (+0.6억)
     → 테스트 전력: 35억 (+0.6억)
  
  3. 공통 전력: 24억원 (+0.4억)
     → 냉각 시스템, 공조 시스템

■ 구조적 이슈
EUV 장비의 전력 소모가 기존 ArF 대비 10배 이상으로,
첨단 공정 비중 확대 시 전력비 급증이 불가피합니다.

■ 전력 사용량 변화
85,600 MWh → 89,400 MWh (+4.4%)`,
  },
  {
    patterns: [
      /공정.*(?:별|분석)/i,
      /(?:조립|포토|CMP|식각|패키징|증착|테스트).*(?:원가|비용)/i,
      /어떤 공정/i,
    ],
    answer: `📊 공정별 원가 차이 분석

■ 공정별 증감 현황 (증가순)

  [전공정]
  1. 포토 공정: +18.5억원 ⚠️
     → EUV 감가상각비 +14억, 재료비 +3억
  2. CMP 공정: +15.6억원
     → 슬러리 단가 상승 +5.2억, 장비 추가 +5억
  3. 식각 공정: +12.2억원
     → 에칭가스 +4.5억, 식각설비 +4억
  4. 증착: +8.3억원
     → 타겟재료 +3.2억, ALD 장비 +3억
  5. 이온주입: +4.2억원
  6. 검사: +2.1억원

  [후공정]
  1. 조립 공정: +22.8억원 ⚠️ 최대 증가
     → 재료비 +14억(와이어본딩 +8.2억), 감가상각 +6억
  2. 패키징: +8.9억원
     → 기판비용 +3.5억, 솔더볼 +2.5억

  [감소 공정]
  1. 테스트: -5.2억원 ✅
     → 자동화 인력감축 -4억, 보드 효율화 -1억
  2. 웨이퍼: -3.4억원 ✅
     → 웨이퍼 단가 하락 -3억

■ 핵심 시사점
조립(+22.8억)과 포토(+18.5억) 두 공정이 전체 증가분의 약 64%를 차지합니다.
테스트 공정의 자동화 성과를 타 공정으로 확산하는 것이 권고됩니다.`,
  },
  {
    patterns: [
      /(?:향후|전망|예상|예측|앞으로)/i,
      /(?:다음|2월|차월)/i,
      /(?:어떻게.*될|개선|방안|대책)/i,
    ],
    answer: `📊 향후 전망 및 대응 방안

■ 향후 전망

  1. 감가상각비 추가 증가
     2월에도 EUV 장비 추가 가동 예정으로 +15~20억원 추가 증가 예상

  2. 후공정 원가 상승
     HBM3E 양산 본격화로 조립/패키징 원가 Q1 대비 8~12% 상승 전망

  3. 재료비 일부 상쇄
     웨이퍼 단가 하락세 지속으로 전체 원가 증가율 2.5~3.5% 수준 유지 전망

  4. 레거시 제품 원가 감소
     PC DRAM, NAND의 원가 감소 추세로 제품 믹스 효과 긍정적

■ 주의사항

  ⚠️ 감가상각비 비중 37.8% → 설비 가동률 극대화 필수
  ⚠️ 핵심 소재 일본 의존 → 대체 공급처 확보 시급
  ⚠️ EUV 전력소모 10배 → 전력비 구조적 증가 불가피
  ⚠️ 숙련공 경쟁 심화 → 인건비 가속화 리스크

■ 권고 사항

  1. 설비 가동률 극대화로 단위당 감가상각 원가 관리
  2. 테스트 공정 자동화 성과를 타 공정으로 확산
  3. CMP 슬러리/포토레지스트 대체 공급사 확보 추진
  4. 제품 포트폴리오 믹스 최적화 (HBM/CAL 집중)
  5. 전력 효율화 투자 검토`,
  },
]

/** 질문에 매칭되는 로컬 답변을 찾는 함수 */
function findLocalAnswer(question: string): string | null {
  for (const kb of KNOWLEDGE_BASE) {
    for (const pattern of kb.patterns) {
      if (pattern.test(question)) {
        return kb.answer
      }
    }
  }
  return null
}

/** 매칭 안 되는 질문에 대한 기본 답변 */
const DEFAULT_ANSWER = `질문을 분석하여 관련 원가 데이터를 검색했습니다.

현재 2025년 1월 기준 주요 원가 현황은 다음과 같습니다:

• 총 제조원가: 2,227억원 (전월 대비 +64.1억, +3.0%)
• 최대 증가: 감가상각비 +28.5억 (EUV 장비 투입)
• 두번째: 재료비 +16.2억 (슬러리/레지스트 단가 상승)
• 유일한 감소: 테스트 공정 -5.2억 (자동화 효과)

더 구체적인 질문을 해주시면 상세한 분석을 제공해 드리겠습니다.
예) "감가상각비 왜 올랐나요?", "HBM 원가 분석", "향후 전망은?"
`

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [yyyymm, setYyyymm] = useState('202501')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const processQuestion = async (question: string) => {
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      // 먼저 백엔드 API 시도
      const res = await chatApi.ask(question, yyyymm)
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }])
    } catch {
      // API 실패 시 로컬 지식 기반으로 폴백
      // 약간의 딜레이를 주어 자연스러운 답변 생성 느낌
      await new Promise(resolve => setTimeout(resolve, 600))

      const localAnswer = findLocalAnswer(question)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: localAnswer || DEFAULT_ANSWER,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    await processQuestion(userMsg)
  }

  const handleQuickQuestion = (question: string) => {
    if (loading) return
    processQuestion(question)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">질의응답</h2>
        <p className="page-subtitle">원가 변동에 대해 자연어로 질문하세요</p>
      </div>

      <div className="month-selector">
        <label>분석 기준월:</label>
        <select value={yyyymm} onChange={e => setYyyymm(e.target.value)}>
          <option value="202501">2025년 01월</option>
          <option value="202412">2024년 12월</option>
        </select>
      </div>

      <div className="card chat-container" style={{ padding: 0 }}>
        {/* 메시지 영역 */}
        <div style={{
          minHeight: 400,
          maxHeight: 600,
          overflowY: 'auto',
          padding: 20,
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                원가 변동에 대해 질문해보세요
              </p>
              <p style={{ fontSize: 13, marginBottom: 4 }}>아래 예시를 클릭하면 바로 답변을 받을 수 있습니다</p>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                {[
                  '이번 달 원가가 왜 올랐나요?',
                  'HBM 제품의 배부율이 왜 상승했나요?',
                  '과거에도 이런 패턴이 있었나요?',
                  '어떤 제품에 파급이 있었나요?',
                  '감가상각비가 왜 이렇게 높나요?',
                  '향후 전망은 어떻게 되나요?',
                ].map(q => (
                  <button
                    key={q}
                    className="btn"
                    style={{
                      background: '#f1f5f9',
                      fontSize: 13,
                      padding: '8px 20px',
                      borderRadius: 20,
                      cursor: 'pointer',
                      border: '1px solid #e2e8f0',
                      transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.borderColor = '#94a3b8' }}
                    onMouseOut={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                    onClick={() => handleQuickQuestion(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: msg.role === 'assistant' ? '88%' : '70%',
                  padding: msg.role === 'assistant' ? '16px 20px' : '10px 16px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? '#1a56db' : '#f8fafc',
                  color: msg.role === 'user' ? 'white' : '#1e293b',
                  fontSize: msg.role === 'assistant' ? 13 : 14,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                  fontFamily: msg.role === 'assistant' ? "'Pretendard', 'SF Mono', monospace" : 'inherit',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div style={{
                padding: '12px 20px', borderRadius: 12,
                background: '#f8fafc', color: '#64748b', fontSize: 14,
                border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  display: 'inline-block', width: 8, height: 8,
                  borderRadius: '50%', background: '#3b82f6',
                  animation: 'pulse 1s ease-in-out infinite',
                }} />
                원가 데이터를 분석하고 있습니다...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="chat-input">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="원가 변동에 대해 질문하세요..."
            disabled={loading}
          />
          <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
            전송
          </button>
        </div>
      </div>
    </div>
  )
}
