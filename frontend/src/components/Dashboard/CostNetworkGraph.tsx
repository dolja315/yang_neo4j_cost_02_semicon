import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  ZoomIn,
  ZoomOut,
  Home,
  TrendingUp,
  TrendingDown,
  Maximize2,
} from 'lucide-react'

/* ═══════════ 타입 ═══════════ */
type NodeType = 'root' | 'process' | 'element' | 'driver' | 'detail' | 'sub_detail' | 'micro' | 'action'

interface NetworkNode {
  id: string
  label: string
  value: number
  variance: number
  type: NodeType
  children?: NetworkNode[]
  relationType?: string
}

/* ═══════════ 상수 ═══════════ */
const LEVEL_RADII = [0, 260, 460, 630, 780, 910, 1020, 1120]

const NODE_SIZES: Record<NodeType, number> = {
  root: 82, process: 68, element: 58, driver: 48, detail: 40, sub_detail: 34, micro: 28, action: 24,
}

const LABEL_FONT: Record<NodeType, number> = {
  root: 14, process: 13, element: 12, driver: 11, detail: 10, sub_detail: 10, micro: 9, action: 9,
}

const VALUE_FONT: Record<NodeType, number> = {
  root: 16, process: 14, element: 13, driver: 12, detail: 11, sub_detail: 10, micro: 9, action: 8,
}

const RELATION_LABELS: Record<string, string> = {
  CONSUMES: '투입', MATERIAL: '재료비', DEPRECIATION: '감가상각', LABOR: '인건비',
  CAUSED_BY: '원인', ROOT_CAUSE: '근본원인', FACTOR: '요인', IMPACT: '영향', ACTION: '대응',
  SUPPLY: '공급', PRICE: '단가', DEMAND: '수요', RISK: '리스크', CONVERT: '전환',
}

const LEVEL_LABELS = ['제품', '공정', '원가요소', '드라이버', '상세원인', '세부요인', '미시요인', '대응방안']

/* ═══════════ 네트워크 데이터 (7레벨, 깊은 드릴다운) ═══════════ */
const networkData: NetworkNode = {
  id: 'root',
  label: 'HBM_001',
  value: 552.8,
  variance: 45.3,
  type: 'root',
  children: [
    /* ── 조립 공정 ── */
    {
      id: 'p1', label: '조립 공정', value: 354, variance: 22.8, type: 'process', relationType: 'CONSUMES',
      children: [
        {
          id: 'e1-1', label: '재료비', value: 142, variance: 14, type: 'element', relationType: 'MATERIAL',
          children: [
            {
              id: 'd1-1-1', label: '와이어본딩', value: 58, variance: 8.2, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                {
                  id: 'dt1-1-1-1', label: 'Au 와이어 단가', value: 38, variance: 5.2, type: 'detail', relationType: 'PRICE',
                  children: [
                    {
                      id: 'sd1-1-1-1-1', label: '국제 금시세 상승', value: 28, variance: 3.8, type: 'sub_detail', relationType: 'FACTOR',
                      children: [
                        {
                          id: 'mc1-1-1-1-1-1', label: '투기적 수요 증가', value: 18, variance: 2.5, type: 'micro', relationType: 'DEMAND',
                          children: [
                            { id: 'ac1-1-1-1-1-1-1', label: '헤징 전략 수립', value: 18, variance: 2.5, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                        { id: 'mc1-1-1-1-1-2', label: '달러 환율 영향', value: 10, variance: 1.3, type: 'micro', relationType: 'FACTOR' },
                      ],
                    },
                    {
                      id: 'sd1-1-1-1-2', label: '사용량 증가', value: 10, variance: 1.4, type: 'sub_detail', relationType: 'DEMAND',
                      children: [
                        { id: 'mc1-1-1-1-2-1', label: 'HBM 적층수 증가', value: 7, variance: 1.0, type: 'micro', relationType: 'FACTOR' },
                        { id: 'mc1-1-1-1-2-2', label: '불량률 소폭 상승', value: 3, variance: 0.4, type: 'micro', relationType: 'FACTOR' },
                      ],
                    },
                  ],
                },
                {
                  id: 'dt1-1-1-2', label: 'Cu 전환 지연', value: 20, variance: 3.0, type: 'detail', relationType: 'CONVERT',
                  children: [
                    {
                      id: 'sd1-1-1-2-1', label: '신뢰성 테스트 미완', value: 14, variance: 2.0, type: 'sub_detail', relationType: 'RISK',
                      children: [
                        {
                          id: 'mc1-1-1-2-1-1', label: '고객사 인증 대기', value: 14, variance: 2.0, type: 'micro', relationType: 'FACTOR',
                          children: [
                            { id: 'ac1-1-1-2-1-1-1', label: '인증 가속화 추진', value: 14, variance: 2.0, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                      ],
                    },
                    { id: 'sd1-1-1-2-2', label: '설비 전환 비용', value: 6, variance: 1.0, type: 'sub_detail', relationType: 'FACTOR' },
                  ],
                },
              ],
            },
            { id: 'd1-1-2', label: '다이본딩', value: 45, variance: 3.8, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'd1-1-3', label: '몰딩재료', value: 39, variance: 2.0, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
        {
          id: 'e1-2', label: '감가상각비', value: 98, variance: 6, type: 'element', relationType: 'DEPRECIATION',
          children: [
            {
              id: 'd1-2-1', label: '조립설비 신규', value: 62, variance: 4.5, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                {
                  id: 'dt1-2-1-1', label: '와이어본더 도입', value: 38, variance: 2.5, type: 'detail', relationType: 'FACTOR',
                  children: [
                    {
                      id: 'sd1-2-1-1-1', label: '신규 라인 증설', value: 38, variance: 2.5, type: 'sub_detail', relationType: 'FACTOR',
                      children: [
                        {
                          id: 'mc1-2-1-1-1-1', label: '생산능력 확장', value: 38, variance: 2.5, type: 'micro', relationType: 'DEMAND',
                          children: [
                            { id: 'ac1-2-1-1-1-1-1', label: 'HBM 수요 대응', value: 38, variance: 2.5, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                      ],
                    },
                  ],
                },
                { id: 'dt1-2-1-2', label: '몰딩기 교체', value: 24, variance: 2.0, type: 'detail', relationType: 'FACTOR' },
              ],
            },
            { id: 'd1-2-2', label: '기존설비 이월', value: 36, variance: 1.5, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
        {
          id: 'e1-3', label: '인건비', value: 67, variance: 2, type: 'element', relationType: 'LABOR',
          children: [
            { id: 'd1-3-1', label: '직접인건비', value: 42, variance: 1.2, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'd1-3-2', label: '간접인건비', value: 25, variance: 0.8, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
      ],
    },

    /* ── 포토 공정 ── */
    {
      id: 'p2', label: '포토 공정', value: 245, variance: 18.5, type: 'process', relationType: 'CONSUMES',
      children: [
        {
          id: 'e2-1', label: '감가상각비', value: 112, variance: 14, type: 'element', relationType: 'DEPRECIATION',
          children: [
            {
              id: 'd2-1-1', label: 'EUV 장비 신규', value: 76, variance: 10.2, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                {
                  id: 'dt2-1-1-1', label: '설비 투자액 증가', value: 50, variance: 7.0, type: 'detail', relationType: 'ROOT_CAUSE',
                  children: [
                    {
                      id: 'sd2-1-1-1-1', label: 'ASML 장비 도입', value: 35, variance: 5.0, type: 'sub_detail', relationType: 'SUPPLY',
                      children: [
                        {
                          id: 'mc2-1-1-1-1-1', label: '장비 단가 상승', value: 22, variance: 3.0, type: 'micro', relationType: 'PRICE',
                          children: [
                            { id: 'ac2-1-1-1-1-1-1', label: '장기 계약 재협상', value: 22, variance: 3.0, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                        { id: 'mc2-1-1-1-1-2', label: '설치비용 증가', value: 13, variance: 2.0, type: 'micro', relationType: 'FACTOR' },
                      ],
                    },
                    {
                      id: 'sd2-1-1-1-2', label: '클린룸 확장', value: 15, variance: 2.0, type: 'sub_detail', relationType: 'FACTOR',
                      children: [
                        { id: 'mc2-1-1-1-2-1', label: '면적 증가', value: 9, variance: 1.2, type: 'micro', relationType: 'FACTOR' },
                        { id: 'mc2-1-1-1-2-2', label: '방진 등급 상향', value: 6, variance: 0.8, type: 'micro', relationType: 'FACTOR' },
                      ],
                    },
                  ],
                },
                {
                  id: 'dt2-1-1-2', label: '가동률 상승', value: 26, variance: 3.2, type: 'detail', relationType: 'ROOT_CAUSE',
                  children: [
                    {
                      id: 'sd2-1-1-2-1', label: '양산 물량 증가', value: 18, variance: 2.2, type: 'sub_detail', relationType: 'DEMAND',
                      children: [
                        {
                          id: 'mc2-1-1-2-1-1', label: 'HBM3E 수요', value: 12, variance: 1.5, type: 'micro', relationType: 'DEMAND',
                          children: [
                            { id: 'ac2-1-1-2-1-1-1', label: 'AI 서버 수요 급증', value: 12, variance: 1.5, type: 'action', relationType: 'IMPACT' },
                          ],
                        },
                        { id: 'mc2-1-1-2-1-2', label: '서버DRAM 수요', value: 6, variance: 0.7, type: 'micro', relationType: 'DEMAND' },
                      ],
                    },
                    {
                      id: 'sd2-1-1-2-2', label: '테스트런 증가', value: 8, variance: 1.0, type: 'sub_detail', relationType: 'FACTOR',
                      children: [
                        { id: 'mc2-1-1-2-2-1', label: '공정 안정화', value: 8, variance: 1.0, type: 'micro', relationType: 'FACTOR' },
                      ],
                    },
                  ],
                },
              ],
            },
            { id: 'd2-1-2', label: '기존 ArF 장비', value: 36, variance: 3.8, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
        {
          id: 'e2-2', label: '재료비', value: 78, variance: 3, type: 'element', relationType: 'MATERIAL',
          children: [
            {
              id: 'd2-2-1', label: '포토레지스트', value: 48, variance: 2.1, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                {
                  id: 'dt2-2-1-1', label: '단가 상승', value: 30, variance: 1.5, type: 'detail', relationType: 'PRICE',
                  children: [
                    {
                      id: 'sd2-2-1-1-1', label: '일본 공급사 인상', value: 20, variance: 1.0, type: 'sub_detail', relationType: 'SUPPLY',
                      children: [
                        {
                          id: 'mc2-2-1-1-1-1', label: '엔화 환율', value: 10, variance: 0.5, type: 'micro', relationType: 'FACTOR',
                          children: [
                            { id: 'ac2-2-1-1-1-1-1', label: '환율 모니터링', value: 10, variance: 0.5, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                        {
                          id: 'mc2-2-1-1-1-2', label: '수출규제 리스크', value: 10, variance: 0.5, type: 'micro', relationType: 'RISK',
                          children: [
                            { id: 'ac2-2-1-1-1-2-1', label: '국산 대체재 R&D', value: 10, variance: 0.5, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                      ],
                    },
                    {
                      id: 'sd2-2-1-1-2', label: 'EUV용 전환', value: 10, variance: 0.5, type: 'sub_detail', relationType: 'CONVERT',
                      children: [
                        { id: 'mc2-2-1-1-2-1', label: '차세대 소재비', value: 10, variance: 0.5, type: 'micro', relationType: 'FACTOR' },
                      ],
                    },
                  ],
                },
                { id: 'dt2-2-1-2', label: '사용량 증가', value: 18, variance: 0.6, type: 'detail', relationType: 'DEMAND' },
              ],
            },
            { id: 'd2-2-2', label: '마스크비', value: 30, variance: 0.9, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
      ],
    },

    /* ── CMP 공정 ── */
    {
      id: 'p3', label: 'CMP 공정', value: 167, variance: 15.6, type: 'process', relationType: 'CONSUMES',
      children: [
        {
          id: 'e3-1', label: '재료비', value: 98, variance: 9, type: 'element', relationType: 'MATERIAL',
          children: [
            {
              id: 'd3-1-1', label: '슬러리', value: 56, variance: 5.2, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                {
                  id: 'dt3-1-1-1', label: '슬러리 단가 상승', value: 35, variance: 3.5, type: 'detail', relationType: 'ROOT_CAUSE',
                  children: [
                    {
                      id: 'sd3-1-1-1-1', label: '공급사 가격 인상', value: 25, variance: 2.5, type: 'sub_detail', relationType: 'SUPPLY',
                      children: [
                        {
                          id: 'mc3-1-1-1-1-1', label: '단일 공급사 리스크', value: 18, variance: 1.8, type: 'micro', relationType: 'RISK',
                          children: [
                            { id: 'ac3-1-1-1-1-1-1', label: '대체 공급사 확보', value: 18, variance: 1.8, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                        {
                          id: 'mc3-1-1-1-1-2', label: '원자재(세리아) 가격', value: 7, variance: 0.7, type: 'micro', relationType: 'PRICE',
                          children: [
                            { id: 'ac3-1-1-1-1-2-1', label: '세리아 수급 모니터링', value: 7, variance: 0.7, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                      ],
                    },
                    {
                      id: 'sd3-1-1-1-2', label: '고순도 전환', value: 10, variance: 1.0, type: 'sub_detail', relationType: 'CONVERT',
                      children: [
                        {
                          id: 'mc3-1-1-1-2-1', label: '미세공정 요구', value: 10, variance: 1.0, type: 'micro', relationType: 'FACTOR',
                          children: [
                            { id: 'ac3-1-1-1-2-1-1', label: '3nm 공정 대응', value: 10, variance: 1.0, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'dt3-1-1-2', label: '품질 개선품 사용', value: 21, variance: 1.7, type: 'detail', relationType: 'ROOT_CAUSE',
                  children: [
                    {
                      id: 'sd3-1-1-2-1', label: '고순도 슬러리', value: 15, variance: 1.2, type: 'sub_detail', relationType: 'FACTOR',
                      children: [
                        { id: 'mc3-1-1-2-1-1', label: '불순물 규격 강화', value: 15, variance: 1.2, type: 'micro', relationType: 'FACTOR' },
                      ],
                    },
                    { id: 'sd3-1-1-2-2', label: '신규 첨가제', value: 6, variance: 0.5, type: 'sub_detail', relationType: 'FACTOR' },
                  ],
                },
              ],
            },
            { id: 'd3-1-2', label: '패드비용', value: 28, variance: 2.8, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'd3-1-3', label: '린스액', value: 14, variance: 1.0, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
        {
          id: 'e3-2', label: '감가상각비', value: 45, variance: 5, type: 'element', relationType: 'DEPRECIATION',
          children: [
            { id: 'd3-2-1', label: 'CMP 장비 추가', value: 45, variance: 5.0, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
      ],
    },

    /* ── 식각 공정 ── */
    {
      id: 'p4', label: '식각 공정', value: 198, variance: 12.2, type: 'process', relationType: 'CONSUMES',
      children: [
        {
          id: 'e4-1', label: '재료비', value: 89, variance: 7, type: 'element', relationType: 'MATERIAL',
          children: [
            {
              id: 'd4-1-1', label: '에칭가스', value: 54, variance: 4.5, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                {
                  id: 'dt4-1-1-1', label: 'NF3 가스', value: 32, variance: 2.5, type: 'detail', relationType: 'FACTOR',
                  children: [
                    {
                      id: 'sd4-1-1-1-1', label: '글로벌 수요 증가', value: 20, variance: 1.5, type: 'sub_detail', relationType: 'DEMAND',
                      children: [
                        { id: 'mc4-1-1-1-1-1', label: '반도체 투자 확대', value: 13, variance: 1.0, type: 'micro', relationType: 'DEMAND' },
                        { id: 'mc4-1-1-1-1-2', label: '디스플레이 수요', value: 7, variance: 0.5, type: 'micro', relationType: 'DEMAND' },
                      ],
                    },
                    {
                      id: 'sd4-1-1-1-2', label: '생산설비 제한', value: 12, variance: 1.0, type: 'sub_detail', relationType: 'SUPPLY',
                      children: [
                        {
                          id: 'mc4-1-1-1-2-1', label: '신규 설비 투자', value: 12, variance: 1.0, type: 'micro', relationType: 'FACTOR',
                          children: [
                            { id: 'ac4-1-1-1-2-1-1', label: '국산 가스 개발', value: 12, variance: 1.0, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'dt4-1-1-2', label: 'CF4 가스', value: 22, variance: 2.0, type: 'detail', relationType: 'FACTOR',
                  children: [
                    {
                      id: 'sd4-1-1-2-1', label: '환경규제 강화', value: 14, variance: 1.2, type: 'sub_detail', relationType: 'RISK',
                      children: [
                        {
                          id: 'mc4-1-1-2-1-1', label: '탄소세 부과', value: 14, variance: 1.2, type: 'micro', relationType: 'FACTOR',
                          children: [
                            { id: 'ac4-1-1-2-1-1-1', label: '저탄소 대안 검토', value: 14, variance: 1.2, type: 'action', relationType: 'ACTION' },
                          ],
                        },
                      ],
                    },
                    { id: 'sd4-1-1-2-2', label: '단가 인상', value: 8, variance: 0.8, type: 'sub_detail', relationType: 'PRICE' },
                  ],
                },
              ],
            },
            { id: 'd4-1-2', label: '챔버부품', value: 35, variance: 2.5, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
        {
          id: 'e4-2', label: '감가상각비', value: 65, variance: 4, type: 'element', relationType: 'DEPRECIATION',
          children: [
            { id: 'd4-2-1', label: '식각설비 신규', value: 65, variance: 4.0, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
      ],
    },

    /* ── 패키징 ── */
    {
      id: 'p5', label: '패키징', value: 287, variance: 8.9, type: 'process', relationType: 'CONSUMES',
      children: [
        {
          id: 'e5-1', label: '재료비', value: 134, variance: 6, type: 'element', relationType: 'MATERIAL',
          children: [
            {
              id: 'd5-1-1', label: '기판비용', value: 78, variance: 3.5, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                {
                  id: 'dt5-1-1-1', label: 'ABF 기판 단가', value: 52, variance: 2.3, type: 'detail', relationType: 'PRICE',
                  children: [
                    {
                      id: 'sd5-1-1-1-1', label: '고다층 기판 수요', value: 35, variance: 1.5, type: 'sub_detail', relationType: 'DEMAND',
                      children: [
                        { id: 'mc5-1-1-1-1-1', label: 'AI 가속기 패키징', value: 22, variance: 1.0, type: 'micro', relationType: 'DEMAND' },
                        { id: 'mc5-1-1-1-1-2', label: '12층+ 기판 요구', value: 13, variance: 0.5, type: 'micro', relationType: 'FACTOR' },
                      ],
                    },
                    { id: 'sd5-1-1-1-2', label: '공급 부족', value: 17, variance: 0.8, type: 'sub_detail', relationType: 'SUPPLY' },
                  ],
                },
                { id: 'dt5-1-1-2', label: '사용량 증가', value: 26, variance: 1.2, type: 'detail', relationType: 'DEMAND' },
              ],
            },
            { id: 'd5-1-2', label: '솔더볼', value: 56, variance: 2.5, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
      ],
    },

    /* ── 증착 ── */
    {
      id: 'p6', label: '증착', value: 223, variance: 8.3, type: 'process', relationType: 'CONSUMES',
      children: [
        {
          id: 'e6-1', label: '재료비', value: 95, variance: 5, type: 'element', relationType: 'MATERIAL',
          children: [
            {
              id: 'd6-1-1', label: '타겟재료', value: 58, variance: 3.2, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                {
                  id: 'dt6-1-1-1', label: '희귀금속 단가', value: 40, variance: 2.2, type: 'detail', relationType: 'PRICE',
                  children: [
                    {
                      id: 'sd6-1-1-1-1', label: '코발트 가격 상승', value: 25, variance: 1.4, type: 'sub_detail', relationType: 'PRICE',
                      children: [
                        { id: 'mc6-1-1-1-1-1', label: '전기차 배터리 수요', value: 16, variance: 0.9, type: 'micro', relationType: 'DEMAND' },
                        { id: 'mc6-1-1-1-1-2', label: '광산 공급 제한', value: 9, variance: 0.5, type: 'micro', relationType: 'SUPPLY' },
                      ],
                    },
                    { id: 'sd6-1-1-1-2', label: '텅스텐 수급', value: 15, variance: 0.8, type: 'sub_detail', relationType: 'SUPPLY' },
                  ],
                },
                { id: 'dt6-1-1-2', label: '타겟 교체 주기', value: 18, variance: 1.0, type: 'detail', relationType: 'FACTOR' },
              ],
            },
            { id: 'd6-1-2', label: '가스류', value: 37, variance: 1.8, type: 'driver', relationType: 'CAUSED_BY' },
          ],
        },
      ],
    },
  ],
}

/* ═══════════ 유틸 함수 ═══════════ */
function countLeaves(node: NetworkNode, expanded: Set<string>): number {
  if (!expanded.has(node.id) || !node.children || node.children.length === 0) return 1
  return node.children.reduce((sum, c) => sum + countLeaves(c, expanded), 0)
}

function findNode(root: NetworkNode, id: string): NetworkNode | null {
  if (root.id === id) return root
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, id)
      if (found) return found
    }
  }
  return null
}

function getNodeColor(variance: number): string {
  if (variance > 10) return '#ef4444'
  if (variance > 5) return '#f97316'
  if (variance > 0) return '#eab308'
  if (variance > -5) return '#60a5fa'
  return '#3b82f6'
}

function getNodeRadius(type: NodeType, variance: number): number {
  const base = NODE_SIZES[type] || 30
  const scale = 1 + Math.min(Math.abs(variance) / 40, 0.5)
  return (base * scale) / 2
}

/* ═══════════ 메인 컴포넌트 ═══════════ */
export function CostNetworkGraph() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']))
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef({ active: false, didDrag: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 })
  const panRef = useRef(panOffset)
  panRef.current = panOffset

  /* ── 노드 토글 ── */
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        const collapse = (id: string) => {
          next.delete(id)
          findNode(networkData, id)?.children?.forEach(c => collapse(c.id))
        }
        collapse(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
    setSelectedNode(nodeId)
  }, [])

  /* ── 방사형 트리 레이아웃 (겹침 없음) ── */
  const positions = useMemo(() => {
    const result = new Map<string, { x: number; y: number; node: NetworkNode; level: number }>()

    const assign = (node: NetworkNode, startAngle: number, endAngle: number, level: number) => {
      const midAngle = (startAngle + endAngle) / 2
      const radius = LEVEL_RADII[Math.min(level, LEVEL_RADII.length - 1)]
      const x = level === 0 ? 0 : Math.cos(midAngle) * radius
      const y = level === 0 ? 0 : Math.sin(midAngle) * radius

      result.set(node.id, { x, y, node, level })

      if (expandedNodes.has(node.id) && node.children && node.children.length > 0) {
        const totalLeaves = node.children.reduce((s, c) => s + countLeaves(c, expandedNodes), 0)
        let cur = startAngle
        for (const child of node.children) {
          const childLeaves = countLeaves(child, expandedNodes)
          const childArc = (endAngle - startAngle) * (childLeaves / totalLeaves)
          assign(child, cur, cur + childArc, level + 1)
          cur += childArc
        }
      }
    }

    // 루트부터 시작, 상단(-π/2)에서 시계방향으로 배치
    assign(networkData, -Math.PI * 0.5, Math.PI * 1.5, 0)
    return result
  }, [expandedNodes])

  /* ── 동적 뷰박스 ── */
  const baseVB = useMemo(() => {
    const allPos = Array.from(positions.values())
    if (allPos.length <= 1) return { x: -500, y: -500, w: 1000, h: 1000 }
    const pad = 200
    const xs = allPos.map(p => p.x)
    const ys = allPos.map(p => p.y)
    const minX = Math.min(...xs) - pad
    const maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad
    const maxY = Math.max(...ys) + pad
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }, [positions])

  const svgViewBox = useMemo(() => {
    const cx = baseVB.x + baseVB.w / 2
    const cy = baseVB.y + baseVB.h / 2
    const zw = baseVB.w / zoom
    const zh = baseVB.h / zoom
    return `${cx - zw / 2 - panOffset.x} ${cy - zh / 2 - panOffset.y} ${zw} ${zh}`
  }, [baseVB, zoom, panOffset])

  /* ── 마우스 이벤트: 드래그 팬 ── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      active: true, didDrag: false,
      startX: e.clientX, startY: e.clientY,
      startPanX: panRef.current.x, startPanY: panRef.current.y,
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.didDrag && Math.hypot(dx, dy) > 4) d.didDrag = true
    if (d.didDrag && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const zw = baseVB.w / zoom
      const zh = baseVB.h / zoom
      setPanOffset({ x: d.startPanX + dx * (zw / rect.width), y: d.startPanY + dy * (zh / rect.height) })
    }
  }, [baseVB, zoom])

  const handleMouseUp = useCallback(() => { dragRef.current.active = false }, [])

  /* ── 마우스 휠: 줌 ── */
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.88 : 1.12
      setZoom(prev => Math.max(0.25, Math.min(6, prev * factor)))
    }
    svg.addEventListener('wheel', handler, { passive: false })
    return () => svg.removeEventListener('wheel', handler)
  }, [])

  /* ── 노드 클릭 ── */
  const handleNodeClick = useCallback((nodeId: string, hasChildren: boolean) => {
    if (dragRef.current.didDrag) return
    if (hasChildren) toggleNode(nodeId)
    else setSelectedNode(nodeId)
  }, [toggleNode])

  /* ── 리셋 / 전체보기 ── */
  const resetView = () => {
    setExpandedNodes(new Set(['root']))
    setSelectedNode(null)
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }
  const fitAll = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }) }

  /* ── 통계 ── */
  const maxLevel = Math.max(0, ...Array.from(positions.values()).map(p => p.level))

  /* ── 선택 노드 정보 ── */
  const selInfo = selectedNode ? positions.get(selectedNode) : null

  return (
    <div className="space-y-4">
      {/* ── 컨트롤 패널 ── */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-bold text-slate-900">원가 드라이버 네트워크 그래프</h3>
              <Badge variant="outline" className="gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {positions.size}개 노드 · {maxLevel}레벨
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(z * 1.3, 6))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(z * 0.7, 0.25))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={fitAll} className="gap-1">
                <Maximize2 className="w-4 h-4" /> 전체보기
              </Button>
              <Button variant="outline" size="sm" onClick={resetView} className="gap-1">
                <Home className="w-4 h-4" /> 초기화
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 범례 ── */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold text-slate-700">차이 크기:</span>
            <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-full bg-red-500" /><span className="text-slate-600">&gt;10억</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-full bg-orange-500" /><span className="text-slate-600">5~10억</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-full bg-yellow-500" /><span className="text-slate-600">0~5억</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded-full bg-blue-400" /><span className="text-slate-600">감소</span></div>
            <div className="h-4 w-px bg-slate-300" />
            <span className="font-semibold text-slate-700">레벨:</span>
            {LEVEL_LABELS.map((lbl, i) => (
              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{i}: {lbl}</span>
            ))}
            <div className="ml-auto text-xs text-slate-500">클릭=드릴다운 · 드래그=이동 · 스크롤=확대/축소</div>
          </div>
        </CardContent>
      </Card>

      {/* ── SVG 그래프 캔버스 ── */}
      <Card className="shadow-lg border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full h-[900px] bg-gradient-to-br from-slate-50 via-white to-slate-50">
            <svg
              ref={svgRef}
              className="w-full h-full select-none"
              viewBox={svgViewBox}
              style={{ cursor: 'grab' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <defs>
                <filter id="glow-sel">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
              </defs>

              {/* ── 엣지 (연결선) ── */}
              <g>
                {Array.from(positions.entries()).map(([nodeId, pos]) => {
                  if (!expandedNodes.has(nodeId) || !pos.node.children) return null
                  return pos.node.children.map(child => {
                    const cp = positions.get(child.id)
                    if (!cp) return null

                    const angle = Math.atan2(cp.y - pos.y, cp.x - pos.x)
                    const pr = getNodeRadius(pos.node.type, pos.node.variance)
                    const cr = getNodeRadius(child.type, child.variance)
                    const sx = pos.x + Math.cos(angle) * pr
                    const sy = pos.y + Math.sin(angle) * pr
                    const ex = cp.x - Math.cos(angle) * cr
                    const ey = cp.y - Math.sin(angle) * cr
                    const mx = (sx + ex) / 2
                    const my = (sy + ey) / 2
                    const opacity = Math.max(0.12, 0.45 - cp.level * 0.05)
                    const sw = Math.max(1, 2.8 - cp.level * 0.3)
                    const labelSize = Math.max(7, 11 - cp.level * 0.6)

                    return (
                      <g key={`e-${nodeId}-${child.id}`}>
                        <line
                          x1={sx} y1={sy} x2={ex} y2={ey}
                          stroke="#94a3b8" strokeWidth={sw}
                          opacity={opacity} markerEnd="url(#arr)"
                        />
                        {child.relationType && (
                          <text
                            x={mx} y={my - 6}
                            fontSize={labelSize} fill="#64748b"
                            textAnchor="middle" opacity={opacity + 0.15}
                            className="pointer-events-none select-none"
                          >
                            {RELATION_LABELS[child.relationType] || child.relationType}
                          </text>
                        )}
                      </g>
                    )
                  })
                })}
              </g>

              {/* ── 노드 ── */}
              <g>
                {Array.from(positions.entries()).map(([nodeId, pos]) => {
                  const { node, level } = pos
                  const r = getNodeRadius(node.type, node.variance)
                  const color = getNodeColor(node.variance)
                  const isSelected = selectedNode === nodeId
                  const hasChildren = !!(node.children && node.children.length > 0)
                  const isExpanded = expandedNodes.has(nodeId)
                  const lf = LABEL_FONT[node.type] || 10
                  const vf = VALUE_FONT[node.type] || 10
                  const strokeW = Math.max(1.5, 3 - level * 0.2)

                  return (
                    <g
                      key={nodeId}
                      onClick={() => handleNodeClick(nodeId, hasChildren)}
                      style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                    >
                      {/* 선택 표시 */}
                      {isSelected && (
                        <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke="#3b82f6" strokeWidth="3" opacity="0.5" filter="url(#glow-sel)" />
                      )}

                      {/* 메인 원 */}
                      <circle cx={pos.x} cy={pos.y} r={r} fill={color} stroke="#fff" strokeWidth={strokeW} />

                      {/* 라벨 (위) */}
                      <text
                        x={pos.x} y={pos.y - r - 8}
                        fontSize={lf} fontWeight="600" fill="#1e293b" textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        {node.label}
                      </text>

                      {/* 차이 금액 (원 안) */}
                      <text
                        x={pos.x} y={pos.y + vf * 0.35}
                        fontSize={vf} fontWeight="bold" fill="#fff" textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        {node.variance > 0 ? '+' : ''}{node.variance}억
                      </text>

                      {/* 총액 (아래) */}
                      <text
                        x={pos.x} y={pos.y + r + 16}
                        fontSize={Math.max(7, lf - 2)} fill="#64748b" textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        ({node.value}억)
                      </text>

                      {/* 확장 버튼 (접힌 노드) */}
                      {hasChildren && !isExpanded && (
                        <g>
                          <circle
                            cx={pos.x + r * 0.7} cy={pos.y - r * 0.7}
                            r={Math.max(8, r * 0.28)} fill="#3b82f6" stroke="#fff" strokeWidth="2"
                          />
                          <text
                            x={pos.x + r * 0.7} y={pos.y - r * 0.7 + 4}
                            fontSize={Math.max(9, r * 0.22)} fontWeight="bold" fill="#fff"
                            textAnchor="middle" className="pointer-events-none select-none"
                          >
                            +
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* ── 선택 노드 상세 패널 ── */}
      <AnimatePresence>
        {selInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="shadow-lg border-blue-500 border-2">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900">{selInfo.node.label}</h3>
                      <Badge className="text-xs bg-slate-100 text-slate-600 border-0">
                        Level {selInfo.level} · {LEVEL_LABELS[selInfo.level] || ''}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6">
                      <div>
                        <div className="text-sm text-slate-500">총 원가</div>
                        <div className="text-2xl font-bold text-slate-900">{selInfo.node.value}억원</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-500">차이</div>
                        <div className={`text-2xl font-bold flex items-center gap-2 ${selInfo.node.variance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {selInfo.node.variance > 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                          {selInfo.node.variance > 0 ? '+' : ''}{selInfo.node.variance}억원
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {selInfo.node.children && selInfo.node.children.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-3">
                      하위 드라이버 ({selInfo.node.children.length}개)
                      {!expandedNodes.has(selectedNode!) && (
                        <span className="text-blue-600 ml-2 font-normal">— 노드를 클릭하여 확장</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {selInfo.node.children.map(child => (
                        <div
                          key={child.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 hover:border-blue-300 transition-colors"
                          onClick={() => { toggleNode(selectedNode!); }}
                        >
                          <div className="text-sm font-medium text-slate-900 mb-1">{child.label}</div>
                          <div className={`text-lg font-bold ${child.variance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {child.variance > 0 ? '+' : ''}{child.variance}억
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {child.children ? `하위 ${child.children.length}개` : '말단 노드'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
