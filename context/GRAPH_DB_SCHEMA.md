# Graph DB 스키마 정의 — GRAPH_DB_SCHEMA.md

> **관련 문서**: `PROJECT_SPEC.md` (전체 기획), `DATA_PREPARATION.md` (데이터 준비)  
> **목적**: Neo4j 그래프 DB의 노드, 관계, 상설/월별 구조 정의

---

## 1. 그래프 DB의 두 가지 레이어

```
┌───────────────────────────────────────────────────────────┐
│  상설 그래프 (Permanent Graph)                              │
│  ─ 한번 구축, 마스터 변경 시 갱신                            │
│  ─ 제품, 공정, 장비, 자재, 원가요소 간의 구조적 관계          │
│  ─ 원가 배부 흐름                                           │
│  ─ 비유: "지도" — 도로와 건물이 이미 있다                    │
│                                                             │
│  역할: "어디서?", "어떻게 배부?"에 답한다                    │
├───────────────────────────────────────────────────────────┤
│  월별 차이 그래프 (Monthly Variance Graph)                   │
│  ─ 매월 자동 생성되어 상설 그래프에 "부착"                   │
│  ─ 차이 노드, 이벤트 노드, 인과관계                         │
│  ─ 비유: "사고 보고서" — 지도 위에 핀을 꽂는 것             │
│                                                             │
│  역할: "왜?", "얼마나?", "누구에게 파급?"에 답한다           │
└───────────────────────────────────────────────────────────┘
```

---

## 2. 상설 그래프: 노드 정의

### 2.1 노드 유형 (Node Labels)

| 라벨 | 설명 | PK 속성 | 주요 속성 | 예상 수량 |
|------|------|---------|-----------|----------|
| `ProductGroup` | 제품군 | grp_cd | grp_nm | ~10 |
| `Product` | 제품코드 | prod_cd | prod_nm, proc_type(FE/BE) | ~900 |
| `Process` | 대공정 | proc_cd | proc_nm, proc_type, alloc_type, alloc_base | ~10 |
| `ProcessGroup` | 공정군 (식각/증착 등) | pgrp_cd | pgrp_nm | ~8 |
| `Equipment` | 장비 | equip_cd | equip_nm, fab_cd | ~3,000 |
| `Material` | 자재/원부재료 | mat_cd | mat_nm, mat_type | ~수천 |
| `CostElement` | 원가요소 | ce_cd | ce_nm, ce_grp | ~30~50 |
| `AllocBase` | 배부기준 | base_cd | base_nm, base_unit | ~5~10 |

### 2.2 노드 속성 상세

```cypher
// 제품군
CREATE (:ProductGroup {
  grp_cd: 'HBM',
  grp_nm: 'HBM',
  created_at: datetime()
})

// 제품코드
CREATE (:Product {
  prod_cd: 'HBM_001',
  prod_nm: 'HBM3E 8Hi',
  grp_cd: 'HBM',
  proc_type: 'FE',      // FE: 전공정용, BE: 후공정용
  use_yn: 'Y',
  created_at: datetime()
})

// 대공정
CREATE (:Process {
  proc_cd: 'FE_01',
  proc_nm: '전공정_1',
  proc_type: 'FE',
  alloc_type: 'ALLOC',   // ALLOC: 배부, DIRECT: 직접집계
  alloc_base: 'ST',      // ST, BOM, QTY
  created_at: datetime()
})

// 공정군
CREATE (:ProcessGroup {
  pgrp_cd: 'ETCH',
  pgrp_nm: '식각',
  proc_type: 'FE',
  created_at: datetime()
})

// 장비
CREATE (:Equipment {
  equip_cd: 'ETCH_A01',
  equip_nm: 'Etcher #01',
  fab_cd: 'FAB3',
  created_at: datetime()
})

// 자재
CREATE (:Material {
  mat_cd: 'MAT_X01',
  mat_nm: 'Substrate_A',
  mat_type: 'SUBSTRATE',
  proc_type: 'BE',
  created_at: datetime()
})

// 원가요소
CREATE (:CostElement {
  ce_cd: 'CE_DEP',
  ce_nm: '감가상각비',
  ce_grp: 'FIXED',
  created_at: datetime()
})

// 배부기준
CREATE (:AllocBase {
  base_cd: 'ST',
  base_nm: '장비가동시간',
  base_unit: '만h',
  created_at: datetime()
})
```

---

## 3. 상설 그래프: 관계 정의

### 3.1 관계 유형 (Relationship Types)

| 관계 | 시작 노드 | 끝 노드 | 설명 | 속성 |
|------|-----------|---------|------|------|
| `CONTAINS` | ProductGroup | Product | 제품군이 제품을 포함 | — |
| `COST_AT` | Product | Process | 제품이 해당 공정에서 원가 발생 | — |
| `HAS_SUBPROCESS` | Process | ProcessGroup | 대공정이 공정군을 포함 | — |
| `HAS_EQUIPMENT` | ProcessGroup | Equipment | 공정군이 장비를 보유 | — |
| `USES_MATERIAL` | Product | Material | 제품이 자재를 BOM에 사용 | std_qty, unit_price |
| `COST_COMPOSED_OF` | Process | CostElement | 공정이 원가요소로 구성 | — |
| `ALLOCATED_BY` | Process | AllocBase | 공정이 해당 기준으로 배부 | — |
| `CONSUMES_GAS` | ProcessGroup | Material | 공정군이 기료를 사용 | — |

### 3.2 관계 생성 Cypher

```cypher
// ── 구조 관계 ──

// 제품군 → 제품
MATCH (g:ProductGroup {grp_cd: 'HBM'}), (p:Product {prod_cd: 'HBM_001'})
CREATE (g)-[:CONTAINS]->(p)

// 제품 → 공정 (원가 발생)
MATCH (p:Product {prod_cd: 'HBM_001'}), (proc:Process {proc_cd: 'FE_01'})
CREATE (p)-[:COST_AT]->(proc)

// 대공정 → 공정군
MATCH (proc:Process {proc_cd: 'FE_01'}), (pg:ProcessGroup {pgrp_cd: 'ETCH'})
CREATE (proc)-[:HAS_SUBPROCESS]->(pg)

// 공정군 → 장비
MATCH (pg:ProcessGroup {pgrp_cd: 'ETCH'}), (e:Equipment {equip_cd: 'ETCH_A01'})
CREATE (pg)-[:HAS_EQUIPMENT]->(e)


// ── 원가 흐름 관계 ──

// 공정 → 원가요소 (원가 구성)
MATCH (proc:Process {proc_cd: 'FE_01'}), (ce:CostElement {ce_cd: 'CE_DEP'})
CREATE (proc)-[:COST_COMPOSED_OF]->(ce)

// 공정 → 배부기준
MATCH (proc:Process {proc_cd: 'FE_01'}), (ab:AllocBase {base_cd: 'ST'})
CREATE (proc)-[:ALLOCATED_BY]->(ab)

// 제품 → 자재 (BOM)
MATCH (p:Product {prod_cd: 'HBM_001'}), (m:Material {mat_cd: 'MAT_X01'})
CREATE (p)-[:USES_MATERIAL {std_qty: 100.0, unit_price: 1350}]->(m)

// 공정군 → 기료
MATCH (pg:ProcessGroup {pgrp_cd: 'ETCH'}), (m:Material {mat_cd: 'MAT_G01'})
CREATE (pg)-[:CONSUMES_GAS]->(m)
```

### 3.3 상설 그래프 전체 모습

```
(HBM) ──CONTAINS──→ (HBM_001) ──COST_AT──→ (FE_01) ──HAS_SUBPROCESS──→ (ETCH)
  │                     │                      │                           │
  ├──CONTAINS──→ (HBM_002)                     ├──COST_COMPOSED_OF──→ (감가상각비)
  │                     │                      ├──COST_COMPOSED_OF──→ (인건비)
(DDR5)──CONTAINS──→(DDR5_001)──COST_AT──→(FE_01) ├──ALLOCATED_BY──→ (ST)
                       │                       │
                       ├──COST_AT──→ (BE_01)   (ETCH) ──HAS_EQUIPMENT──→ (ETCH_A01)
                       │               │              ──HAS_EQUIPMENT──→ (ETCH_A02)
                       └──USES_MATERIAL──→ (Substrate_A)
                       └──USES_MATERIAL──→ (Wire_B)
```

---

## 4. 월별 차이 그래프: 노드 정의

> 매월 차이 계산 후 자동 생성되어 상설 그래프에 부착됨

### 4.1 노드 유형

| 라벨 | 설명 | 생성 시점 | 예상 수량/월 |
|------|------|----------|-------------|
| `Variance` | 차이 분석 결과 | 매월 자동 | 20,000~35,000 |
| `Event` | 소스시스템 변동 이벤트 | 매월 자동 | 500~1,000 |

### 4.2 Variance 노드 (차이 노드)

```cypher
CREATE (:Variance {
  // ── 식별 ──
  var_id: 'V202501_HBM_001_FE01_DEP_RV',
  yyyymm: '202501',

  // ── 위치 ──
  product_grp: 'HBM',
  product_cd: 'HBM_001',        // NULL이면 제품군 레벨
  proc_cd: 'FE_01',
  ce_cd: 'CE_DEP',

  // ── 차이 수치 ──
  var_type: 'RATE_VAR',          // RATE_VAR, QTY_VAR, PRICE_VAR, USAGE_VAR 등
  var_amt: 10.5,                 // 억원
  var_rate: 0.111,               // 11.1%
  prev_amt: 95.0,
  curr_amt: 108.0,

  // ── 계층 레벨 ──
  level: 'PRODUCT',              // GROUP (제품군) / PRODUCT (제품코드)

  // ── LLM 판정 (Step 5에서 업데이트) ──
  llm_summary: NULL,             // LLM 해석 코멘트
  llm_classification: NULL,      // 일시적 / 구조적 / 의도적
  llm_confidence: NULL,          // 높음 / 중간 / 낮음
  llm_alert_level: NULL,         // 정상 / 관찰 / 경고 / 긴급
  llm_recommendation: NULL,      // 권고 사항

  created_at: datetime()
})
```

### 4.3 Variance 노드 차이유형 코드

```
[전공정 — 배부 방식]

TOTAL_VAR     총 원가 차이 (제품 × 공정 × 원가요소 레벨)
RATE_VAR      배부율 차이: (R₁-R₀) × Q₁
QTY_VAR       배부량 차이: R₀ × (Q₁-Q₀)
RATE_COST     배부율차이 중 총비용 변동 효과
RATE_BASE     배부율차이 중 총배부기준량 변동 효과

[후공정 재료비 — 집계 방식]

MAT_TOTAL_VAR 총 재료비 차이
PRICE_VAR     단가 차이: Σ(P₁-P₀) × Q₁
USAGE_VAR     사용량 차이: ΣP₀ × (Q₁-Q₀)

[후공정 가공비 — 배부 방식]

RATE_VAR      배부율 차이 (전공정과 동일)
QTY_VAR       배부량 차이 (전공정과 동일)

[제품군 레벨 집계]

GRP_TOTAL_VAR 제품군 총 원가 차이
```

### 4.4 Variance 노드 계층적 생성 규칙

```
[Level 1: 제품군 레벨 — 전체 생성]

  모든 제품군 × 대공정 × 원가요소에 대해 차이 노드 생성
  product_cd = NULL, level = 'GROUP'
  예상: ~2,000~3,000개/월

[Level 2: 제품코드 레벨 — 임계값 초과만]

  임계값 조건 (OR 조건):
    |var_rate| >= 3%    (비율 기준)
    |var_amt| >= 1억원  (금액 기준)

  product_cd = 실제코드, level = 'PRODUCT'
  예상: ~15,000~30,000개/월
```

### 4.5 Event 노드 (이벤트 노드)

```cypher
// MES 이벤트
CREATE (:Event {
  event_id: 'MES_202501_ETCH_A01_UTIL',
  yyyymm: '202501',
  source: 'MES',                 // MES / PLM / PURCHASE
  event_type: 'UTIL_CHG',        // UTIL_CHG, YIELD_CHG, CT_CHG, BOM_CHG, PRICE_CHG 등

  // ── 이벤트 상세 ──
  target_cd: 'ETCH_A01',         // 관련 장비/자재/제품 코드
  metric_type: 'UTIL',
  prev_value: 85.0,
  curr_value: 78.0,
  chg_value: -7.0,
  chg_rate: -0.0824,
  description: 'FAB3 ETCH_A01 가동률 85%→78%, 신규라인 가동 초기',

  created_at: datetime()
})

// 구매 이벤트
CREATE (:Event {
  event_id: 'PUR_202501_MAT_X01',
  yyyymm: '202501',
  source: 'PURCHASE',
  event_type: 'PRICE_CHG',
  target_cd: 'MAT_X01',
  prev_value: 1200,
  curr_value: 1350,
  chg_rate: 0.125,
  description: 'Substrate_A 단가 1,200→1,350, 원자재 가격 상승',
  created_at: datetime()
})

// PLM 이벤트
CREATE (:Event {
  event_id: 'PLM_202501_001',
  yyyymm: '202501',
  source: 'PLM',
  event_type: 'BOM_CHG',
  target_cd: 'HBM_001',
  description: 'Wire_B 사용량 200→210 변경',
  created_at: datetime()
})
```

---

## 5. 월별 차이 그래프: 관계 정의

### 5.1 관계 유형

| 관계 | 시작 노드 | 끝 노드 | 설명 | 생성 방법 |
|------|-----------|---------|------|----------|
| `CAUSED_BY` | Variance | Variance | 인과관계 (원인) | 규칙 기반 |
| `EVIDENCED_BY` | Variance | Event | 근거 관계 | 규칙 기반 매칭 |
| `SPREADS_TO` | Variance | Variance | 파급 관계 | 규칙 기반 |
| `SIMILAR_TO` | Variance | Variance | 과거 유사 사례 | 패턴 매칭 |
| `OCCURS_AT` | Variance | Product | 차이 발생 제품 | 자동 |
| `OCCURS_IN` | Variance | Process | 차이 발생 공정 | 자동 |
| `RELATES_TO` | Variance | CostElement | 관련 원가요소 | 자동 |
| `INVOLVES` | Event | Equipment | 이벤트 관련 장비 | 자동 |
| `INVOLVES` | Event | Material | 이벤트 관련 자재 | 자동 |
| `INVOLVES` | Event | Product | 이벤트 관련 제품 | 자동 |

### 5.2 관계 속성

```cypher
// 인과관계: 기여도 포함
(v1:Variance)-[:CAUSED_BY {
  contribution: 0.75,       // 기여도 (0~1)
  rule_id: 'RULE_02',      // 어떤 규칙으로 생성되었는지
  created_at: datetime()
}]->(v2:Variance)

// 근거관계: 매칭 신뢰도 포함
(v:Variance)-[:EVIDENCED_BY {
  match_score: 0.9,         // 매칭 점수 (시점+공정 일치도)
  rule_id: 'RULE_03',
  created_at: datetime()
}]->(e:Event)

// 파급관계
(v1:Variance)-[:SPREADS_TO {
  same_alloc_base: 'ST',    // 공유하는 배부기준
  rule_id: 'RULE_05',
  created_at: datetime()
}]->(v2:Variance)

// 유사사례: 유사도 점수 포함
(v1:Variance)-[:SIMILAR_TO {
  similarity: 0.85,         // 유사도 (0~1)
  pattern: 'NEW_LINE_RAMP', // 패턴 분류
  created_at: datetime()
}]->(v2:Variance)

// 위치 연결 (차이 → 상설 노드)
(v:Variance)-[:OCCURS_AT]->(p:Product)
(v:Variance)-[:OCCURS_IN]->(proc:Process)
(v:Variance)-[:RELATES_TO]->(ce:CostElement)
(e:Event)-[:INVOLVES]->(eq:Equipment)
(e:Event)-[:INVOLVES]->(m:Material)
```

---

## 6. 인과관계 자동 생성 규칙 (상세)

### 6.1 규칙 엔진 개요

```
규칙 실행 순서:
  Rule 1 → Rule 2 → Rule 3 → Rule 4 → Rule 5 → Rule 6

각 규칙은:
  1. 조건(IF)을 확인하고
  2. 노드 간 관계(THEN)를 생성하고
  3. 기여도(contribution)를 계산한다
```

### 6.2 Rule 1: 제품 원가 차이 → 원가요소별 분해

```
IF:
  제품 레벨의 TOTAL_VAR 노드가 존재

THEN:
  해당 제품의 공정 × 원가요소별 차이 노드(RATE_VAR, QTY_VAR 등) 중
  |var_amt| 기준 상위 항목을 CAUSED_BY로 연결

  contribution = 해당 항목 |var_amt| / 전체 |var_amt| 합

CYPHER:
  MATCH (total:Variance {product_cd: 'HBM_001', var_type: 'TOTAL_VAR', yyyymm: '202501'})
  MATCH (detail:Variance {product_cd: 'HBM_001', yyyymm: '202501'})
  WHERE detail.var_type IN ['RATE_VAR', 'QTY_VAR', 'PRICE_VAR', 'USAGE_VAR']
    AND abs(detail.var_amt) > 0
  CREATE (total)-[:CAUSED_BY {
    contribution: abs(detail.var_amt) / total_sum,
    rule_id: 'RULE_01'
  }]->(detail)
```

### 6.3 Rule 2: 배부율 차이 → 총비용/총배부기준량 분해

```
IF:
  RATE_VAR 노드가 존재

THEN:
  같은 공정+원가요소의 RATE_COST, RATE_BASE 노드를 찾아
  CAUSED_BY로 연결

  contribution = |해당 효과| / |RATE_VAR|

CYPHER:
  MATCH (rate:Variance {var_type: 'RATE_VAR', proc_cd: 'FE_01', ce_cd: 'CE_DEP', yyyymm: '202501'})
  MATCH (sub:Variance {proc_cd: 'FE_01', ce_cd: 'CE_DEP', yyyymm: '202501'})
  WHERE sub.var_type IN ['RATE_COST', 'RATE_BASE']
  CREATE (rate)-[:CAUSED_BY {
    contribution: abs(sub.var_amt) / abs(rate.var_amt),
    rule_id: 'RULE_02'
  }]->(sub)
```

### 6.4 Rule 3: 배부기준량(ST) 변동 → MES 이벤트 매칭

```
IF:
  RATE_BASE 노드가 존재 (총배부기준량 변동 효과가 유의미)
  AND 해당 공정의 배부기준이 ST

THEN:
  같은 월, 같은 공정(공정군 소속 장비)의 MES 이벤트 중
  가동률(UTIL) 변동 이벤트를 찾아 EVIDENCED_BY로 연결

  match_score = 공정 일치(0.5) + 시점 일치(0.3) + 방향 일치(0.2)

매칭 로직:
  1. RATE_BASE 노드의 proc_cd → 해당 Process의 HAS_SUBPROCESS → ProcessGroup
  2. ProcessGroup의 HAS_EQUIPMENT → Equipment 목록
  3. 해당 Equipment의 MES Event 중 UTIL_CHG 타입 필터
  4. 변동 방향 일치 확인 (ST 감소 ↔ 가동률 하락)

CYPHER:
  MATCH (rb:Variance {var_type: 'RATE_BASE', yyyymm: '202501'})
  MATCH (rb)-[:OCCURS_IN]->(proc:Process)-[:HAS_SUBPROCESS]->(pg:ProcessGroup)
        -[:HAS_EQUIPMENT]->(eq:Equipment)
  MATCH (evt:Event {yyyymm: '202501', source: 'MES', event_type: 'UTIL_CHG'})
        -[:INVOLVES]->(eq)
  WHERE evt.chg_value < 0  // 가동률 하락 = ST 감소 방향 일치
  CREATE (rb)-[:EVIDENCED_BY {
    match_score: 0.9,
    rule_id: 'RULE_03'
  }]->(evt)
```

### 6.5 Rule 4: 재료비 변동 → 구매/PLM 이벤트 매칭

```
IF:
  PRICE_VAR 노드가 존재 (단가 차이)

THEN:
  같은 월, 관련 자재의 구매 이벤트(PRICE_CHG)를 찾아 EVIDENCED_BY로 연결

CYPHER:
  MATCH (pv:Variance {var_type: 'PRICE_VAR', yyyymm: '202501'})
  MATCH (pv)-[:OCCURS_AT]->(prod:Product)-[:USES_MATERIAL]->(mat:Material)
  MATCH (evt:Event {yyyymm: '202501', source: 'PURCHASE', event_type: 'PRICE_CHG'})
        -[:INVOLVES]->(mat)
  CREATE (pv)-[:EVIDENCED_BY {
    match_score: 0.95,
    rule_id: 'RULE_04a'
  }]->(evt)

IF:
  USAGE_VAR 노드가 존재 (사용량 차이)

THEN:
  같은 월, 관련 제품의 PLM 이벤트(BOM_CHG)를 찾아 EVIDENCED_BY로 연결

CYPHER:
  MATCH (uv:Variance {var_type: 'USAGE_VAR', yyyymm: '202501'})
  MATCH (uv)-[:OCCURS_AT]->(prod:Product)
  MATCH (evt:Event {yyyymm: '202501', source: 'PLM', event_type: 'BOM_CHG'})
        -[:INVOLVES]->(prod)
  CREATE (uv)-[:EVIDENCED_BY {
    match_score: 0.85,
    rule_id: 'RULE_04b'
  }]->(evt)
```

### 6.6 Rule 5: 파급 관계 생성

```
IF:
  RATE_VAR 노드의 |var_rate| >= 5% (배부율 차이가 유의미)

THEN:
  같은 공정 + 같은 원가요소에서 배부를 받는 다른 제품의 RATE_VAR을 찾아
  SPREADS_TO로 연결

CYPHER:
  MATCH (v1:Variance {var_type: 'RATE_VAR', proc_cd: 'FE_01', ce_cd: 'CE_DEP',
                       yyyymm: '202501', product_cd: 'HBM_001'})
  WHERE abs(v1.var_rate) >= 0.05
  MATCH (v2:Variance {var_type: 'RATE_VAR', proc_cd: 'FE_01', ce_cd: 'CE_DEP',
                       yyyymm: '202501'})
  WHERE v2.product_cd <> 'HBM_001'
  CREATE (v1)-[:SPREADS_TO {
    same_alloc_base: 'ST',
    rule_id: 'RULE_05'
  }]->(v2)
```

### 6.7 Rule 6: 유사 과거 사례 매칭

```
IF:
  차이 노드가 존재

THEN:
  과거 6~12개월 차이 노드 중
  같은 공정 + 같은 원가요소 + 비슷한 변동 크기(±50%)의 노드를 찾아
  SIMILAR_TO로 연결

유사도 계산:
  similarity = (공정 일치 × 0.3) + (요소 일치 × 0.2)
             + (크기 유사 × 0.3) + (방향 일치 × 0.2)

CYPHER:
  MATCH (curr:Variance {yyyymm: '202501', proc_cd: 'FE_01', ce_cd: 'CE_DEP',
                         var_type: 'RATE_VAR'})
  MATCH (past:Variance {proc_cd: 'FE_01', ce_cd: 'CE_DEP', var_type: 'RATE_VAR'})
  WHERE past.yyyymm < '202501'
    AND past.yyyymm >= '202401'
    AND abs(past.var_rate - curr.var_rate) / abs(curr.var_rate) < 0.5
    AND sign(past.var_amt) = sign(curr.var_amt)
  CREATE (curr)-[:SIMILAR_TO {
    similarity: calculated_score,
    pattern: 'RATE_INCREASE',
    rule_id: 'RULE_06'
  }]->(past)
```

---

## 7. LLM 탐색용 쿼리 패턴

### 7.1 "왜 올랐나?" — 인과 경로 전체 탐색

```cypher
// HBM_001의 모든 인과관계 경로 (최대 깊이 5)
MATCH path = (start:Variance {product_cd: 'HBM_001', yyyymm: '202501',
                               var_type: 'TOTAL_VAR'})
             -[:CAUSED_BY|EVIDENCED_BY*1..5]->(end)
RETURN path
ORDER BY length(path)
```

### 7.2 "어디에 파급되었나?" — 파급 경로 탐색

```cypher
// HBM_001 배부율 차이의 파급 범위
MATCH (start:Variance {product_cd: 'HBM_001', var_type: 'RATE_VAR', yyyymm: '202501'})
      -[:SPREADS_TO]->(affected:Variance)
RETURN affected.product_cd, affected.var_amt, affected.var_rate
```

### 7.3 "과거에도 이런 적 있었나?" — 유사 사례 탐색

```cypher
// 유사 과거 사례 + 당시 LLM 판정
MATCH (curr:Variance {product_cd: 'HBM_001', var_type: 'RATE_VAR', yyyymm: '202501'})
      -[s:SIMILAR_TO]->(past:Variance)
RETURN past.yyyymm, past.var_rate, past.llm_classification,
       past.llm_summary, s.similarity
ORDER BY s.similarity DESC
```

### 7.4 "전체 맥락 한 번에" — LLM 증거 패키지 조립

```cypher
// 특정 차이 노드의 전체 증거 패키지
MATCH (v:Variance {var_id: 'V202501_HBM_001_FE01_DEP_RV'})

// 인과 경로
OPTIONAL MATCH causal = (v)-[:CAUSED_BY*1..3]->(cause)
// 근거 이벤트
OPTIONAL MATCH (leaf)-[:EVIDENCED_BY]->(evt:Event)
  WHERE (v)-[:CAUSED_BY*0..3]->(leaf)
// 파급 범위
OPTIONAL MATCH (v)-[:SPREADS_TO]->(spread:Variance)
// 유사 사례
OPTIONAL MATCH (v)-[:SIMILAR_TO]->(similar:Variance)

RETURN v, collect(DISTINCT cause), collect(DISTINCT evt),
       collect(DISTINCT spread), collect(DISTINCT similar)
```

---

## 8. 월별 그래프 생성 프로세스 (Step 4 상세)

```
Step 4a: 상설 그래프 갱신
  ─ MST 테이블의 변경분 확인
  ─ 신규 제품/장비/자재 노드 추가
  ─ 폐기된 항목 use_yn 업데이트

Step 4b: 차이 노드 생성
  ─ CAL_VARIANCE 테이블 조회
  ─ 계층적 생성 (제품군 전체 + 제품코드 임계값 초과)
  ─ Variance 노드 생성
  ─ 위치 연결: OCCURS_AT, OCCURS_IN, RELATES_TO

Step 4c: 이벤트 노드 생성
  ─ EVT_MES, EVT_PLM, EVT_PURCHASE 테이블 조회
  ─ Event 노드 생성
  ─ 대상 연결: INVOLVES (장비/자재/제품)

Step 4d: 인과관계 연결 (규칙 엔진 실행)
  ─ Rule 1 실행: 제품 총차이 → 원가요소별 분해 연결
  ─ Rule 2 실행: 배부율 차이 → 비용/기준량 분해 연결
  ─ Rule 3 실행: 배부기준량 변동 → MES 이벤트 매칭
  ─ Rule 4 실행: 재료비 변동 → 구매/PLM 이벤트 매칭
  ─ Rule 5 실행: 파급 관계 생성
  ─ Rule 6 실행: 유사 과거 사례 매칭
```

---

## 9. 인덱스 및 제약조건

```cypher
// 유니크 제약조건
CREATE CONSTRAINT FOR (pg:ProductGroup) REQUIRE pg.grp_cd IS UNIQUE;
CREATE CONSTRAINT FOR (p:Product) REQUIRE p.prod_cd IS UNIQUE;
CREATE CONSTRAINT FOR (proc:Process) REQUIRE proc.proc_cd IS UNIQUE;
CREATE CONSTRAINT FOR (eq:Equipment) REQUIRE eq.equip_cd IS UNIQUE;
CREATE CONSTRAINT FOR (m:Material) REQUIRE m.mat_cd IS UNIQUE;
CREATE CONSTRAINT FOR (ce:CostElement) REQUIRE ce.ce_cd IS UNIQUE;
CREATE CONSTRAINT FOR (v:Variance) REQUIRE v.var_id IS UNIQUE;
CREATE CONSTRAINT FOR (e:Event) REQUIRE e.event_id IS UNIQUE;

// 탐색 성능용 인덱스
CREATE INDEX FOR (v:Variance) ON (v.yyyymm);
CREATE INDEX FOR (v:Variance) ON (v.product_cd);
CREATE INDEX FOR (v:Variance) ON (v.product_grp);
CREATE INDEX FOR (v:Variance) ON (v.var_type);
CREATE INDEX FOR (e:Event) ON (e.yyyymm);
CREATE INDEX FOR (e:Event) ON (e.source);
```

---

## 10. 데이터 보존 정책

```
상설 그래프:  영구 보존 (마스터)
차이 노드:   3년 보존 → 이후 아카이빙
이벤트 노드: 3년 보존 → 이후 아카이빙
인과관계:    차이 노드와 함께 보존/아카이빙
```

---

## 11. 프로토타입 규모 요약

| 항목 | 프로토타입 | 실제 (1년) |
|------|-----------|-----------|
| 상설 노드 | ~50개 | ~15,000개 |
| 상설 엣지 | ~100개 | ~50,000개 |
| 월별 차이 노드 | ~200개 | ~25,000개 |
| 월별 이벤트 노드 | ~10개 | ~800개 |
| 월별 인과 엣지 | ~300개 | ~50,000개 |
| 6개월 누적 노드 | ~1,300개 | ~205,000개 |
| 6개월 누적 엣지 | ~2,000개 | ~350,000개 |
