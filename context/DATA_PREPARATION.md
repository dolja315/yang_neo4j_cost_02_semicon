# 데이터 준비 가이드 — DATA_PREPARATION.md

> **관련 문서**: `PROJECT_SPEC.md` (전체 기획), `GRAPH_DB_SCHEMA.md` (그래프 DB)  
> **목적**: Oracle(RDB) 테이블 설계 + 프로토타입용 샘플 데이터 정의

---

## 1. 데이터 레이어 구조

```
┌─────────────────────────────────────────────────────┐
│                    Oracle DB                         │
│                                                      │
│  [Layer A] 마스터 데이터        ── 제품, 공정, 장비 등│
│  [Layer B] SAP 스냅샷 데이터    ── 원가결과, 배부 내역│
│  [Layer C] 소스시스템 이벤트    ── MES, PLM, 구매    │
│  [Layer D] 차이 계산 결과       ── Python이 생성     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 2. Layer A: 마스터 데이터

### 2.1 제품 마스터 (MST_PRODUCT)

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| PRODUCT_CD | VARCHAR(20) PK | 제품코드 | HBM_001 |
| PRODUCT_GRP | VARCHAR(20) | 제품군 | HBM |
| PRODUCT_NM | VARCHAR(100) | 제품명 | HBM3E 8Hi |
| PROC_TYPE | VARCHAR(10) | 전공정/후공정 구분 | FE / BE |
| USE_YN | CHAR(1) | 사용여부 | Y |

```
프로토타입 샘플 데이터:

제품군     제품코드      공정구분
─────────────────────────────────
HBM       HBM_001      FE, BE
HBM       HBM_002      FE, BE
DDR5      DDR5_001     FE, BE
DDR5      DDR5_002     FE, BE
낸드      NAND_001     FE, BE
낸드      NAND_002     FE, BE
P5        P5_001       FE, BE
P5        P5_002       FE, BE

※ 프로토타입: 4개 제품군 × 2개 제품코드 = 8개 제품
※ 실제: 전공정 ~100개, 후공정 ~800개
```

### 2.2 공정 마스터 (MST_PROCESS)

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| PROC_CD | VARCHAR(20) PK | 공정코드 | FE_01 |
| PROC_NM | VARCHAR(100) | 공정명 | 전공정_1 |
| PROC_TYPE | VARCHAR(10) | 전공정/후공정 | FE / BE |
| PROC_GRP | VARCHAR(20) | 공정군 (FAB) | ETCH / DEP |
| ALLOC_TYPE | VARCHAR(20) | 배부방식 | ALLOC / DIRECT |
| ALLOC_BASE | VARCHAR(20) | 배부기준 | ST / BOM / QTY |

```
프로토타입 샘플:

공정코드  공정명     유형  공정군    배부방식    배부기준
──────────────────────────────────────────────────────
FE_01    전공정_1   FE    ETCH     ALLOC      ST
FE_02    전공정_2   FE    DEP      ALLOC      ST
FE_03    전공정_3   FE    PHOTO    ALLOC      ST
FE_04    전공정_4   FE    DIFF     ALLOC      ST
FE_05    전공정_5   FE    CMP      ALLOC      ST
BE_01    후공정_조립 BE    ASSY     DIRECT     BOM (재료비)
BE_02    후공정_조립 BE    ASSY     ALLOC      ST (가공비)
BE_03    후공정_테스트 BE  TEST     ALLOC      QTY

※ 프로토타입: 전공정 5개 + 후공정 3개 = 8개 공정
※ 실제: 대공정 10개, FAB Step 750개
```

### 2.3 장비 마스터 (MST_EQUIPMENT)

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| EQUIP_CD | VARCHAR(20) PK | 장비코드 | ETCH_A01 |
| EQUIP_NM | VARCHAR(100) | 장비명 | Etcher #01 |
| PROC_CD | VARCHAR(20) FK | 소속 공정 | FE_01 |
| FAB_CD | VARCHAR(20) | FAB 코드 | FAB3 |

```
프로토타입 샘플:

장비코드      소속공정  FAB
────────────────────────────
ETCH_A01     FE_01    FAB3
ETCH_A02     FE_01    FAB3
DEP_B01      FE_02    FAB3
DEP_B02      FE_02    FAB3
PHOTO_C01    FE_03    FAB3
ASSY_D01     BE_01    PKG1
TEST_E01     BE_03    PKG1

※ 프로토타입: 7대
※ 실제: ~3,000대
```

### 2.4 자재 마스터 (MST_MATERIAL)

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| MAT_CD | VARCHAR(20) PK | 자재코드 | MAT_X01 |
| MAT_NM | VARCHAR(100) | 자재명 | Substrate_A |
| MAT_TYPE | VARCHAR(20) | 자재유형 | SUBSTRATE / WIRE / GAS |
| PROC_TYPE | VARCHAR(10) | 사용공정유형 | FE / BE |

```
프로토타입 샘플:

자재코드   자재명           유형          사용공정
──────────────────────────────────────────────────
MAT_X01   Substrate_A     SUBSTRATE    BE
MAT_X02   Wire_B          WIRE         BE
MAT_X03   Mold_Compound   MOLD         BE
MAT_G01   Etch_Gas_1      GAS          FE
MAT_G02   Dep_Gas_1       GAS          FE

※ 프로토타입: 5종
※ 실제: 수천 종
```

### 2.5 원가요소 마스터 (MST_COST_ELEMENT)

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| CE_CD | VARCHAR(20) PK | 원가요소코드 | CE_DEP |
| CE_NM | VARCHAR(100) | 원가요소명 | 감가상각비 |
| CE_GRP | VARCHAR(20) | 원가요소그룹 | FIXED / VARIABLE |

```
프로토타입 샘플:

코드      원가요소명    그룹
────────────────────────────
CE_DEP   감가상각비    FIXED
CE_LAB   인건비       FIXED
CE_PWR   전력비       VARIABLE
CE_MAT   재료비       VARIABLE
CE_MNT   수선유지비    VARIABLE
CE_GAS   기료비       VARIABLE
CE_OTH   기타경비     MIXED

※ 프로토타입: 7종
※ 실제: 30~50종
```

---

## 3. Layer B: SAP 스냅샷 데이터

### 3.1 원가결과 스냅샷 (SNP_COST_RESULT)

> SAP CBO 원가 계산 최종 결과. 매월 적재.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| YYYYMM | CHAR(6) PK | 기준월 |
| PRODUCT_CD | VARCHAR(20) PK | 제품코드 |
| PROC_CD | VARCHAR(20) PK | 공정코드 |
| CE_CD | VARCHAR(20) PK | 원가요소코드 |
| COST_AMT | DECIMAL(18,2) | 원가금액 (억원) |

```
샘플 데이터 (HBM_001 발췌):

월       제품코드   공정    원가요소    금액(억)
──────────────────────────────────────────────
202412  HBM_001  FE_01  CE_DEP     95.0
202412  HBM_001  FE_01  CE_LAB     40.0
202412  HBM_001  FE_01  CE_PWR     25.0
202412  HBM_001  FE_02  CE_DEP     45.0
202412  HBM_001  BE_01  CE_MAT     60.0
202412  HBM_001  BE_02  CE_DEP     30.0
202501  HBM_001  FE_01  CE_DEP    108.0   ← +13.7%
202501  HBM_001  FE_01  CE_LAB     41.0   ← +2.5%
202501  HBM_001  FE_01  CE_PWR     26.5   ← +6.0%
202501  HBM_001  FE_02  CE_DEP     47.0   ← +4.4%
202501  HBM_001  BE_01  CE_MAT     66.0   ← +10.0%
202501  HBM_001  BE_02  CE_DEP     31.0   ← +3.3%
```

### 3.2 배부율 스냅샷 (SNP_ALLOC_RATE)

> 공정별 배부율 산출 내역. 매월 적재.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| YYYYMM | CHAR(6) PK | 기준월 |
| PROC_CD | VARCHAR(20) PK | 공정코드 |
| CE_CD | VARCHAR(20) PK | 원가요소코드 |
| TOTAL_COST | DECIMAL(18,2) | 총비용 (억원) |
| TOTAL_BASE | DECIMAL(18,4) | 총배부기준량 |
| BASE_UNIT | VARCHAR(10) | 배부기준 단위 (만h, 개, kg) |
| ALLOC_RATE | DECIMAL(18,6) | 배부율 (총비용 / 총배부기준량) |

```
샘플 데이터:

월       공정    원가요소   총비용(억)  총ST(만h)  배부율
────────────────────────────────────────────────────────
202412  FE_01  CE_DEP    500.0     100.0     50,000
202501  FE_01  CE_DEP    515.0      93.0     55,376  ← 배부율 +10.8%
202412  FE_01  CE_LAB    200.0     100.0     20,000
202501  FE_01  CE_LAB    204.0      93.0     21,935  ← 배부율 +9.7%
202412  FE_02  CE_DEP    300.0      80.0     37,500
202501  FE_02  CE_DEP    308.0      78.5     39,236  ← 배부율 +4.6%
```

### 3.3 배부결과 스냅샷 (SNP_ALLOC_RESULT)

> 제품별 배부량 및 배부액. 매월 적재.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| YYYYMM | CHAR(6) PK | 기준월 |
| PRODUCT_CD | VARCHAR(20) PK | 제품코드 |
| PROC_CD | VARCHAR(20) PK | 공정코드 |
| CE_CD | VARCHAR(20) PK | 원가요소코드 |
| ALLOC_QTY | DECIMAL(18,4) | 제품별 배부량 |
| ALLOC_AMT | DECIMAL(18,2) | 배부액 (억원) |

```
샘플 데이터:

월       제품코드   공정    원가요소   배부량(만h)  배부액(억)
────────────────────────────────────────────────────────────
202412  HBM_001  FE_01  CE_DEP    19.0        95.0
202501  HBM_001  FE_01  CE_DEP    19.5       108.0
202412  DDR5_001 FE_01  CE_DEP    30.0       150.0
202501  DDR5_001 FE_01  CE_DEP    28.0       155.0
202412  NAND_001 FE_01  CE_DEP    25.0       125.0
202501  NAND_001 FE_01  CE_DEP    23.0       127.4
```

### 3.4 BOM 스냅샷 (SNP_BOM)

> 후공정 제품별 BOM (재료비 직접 집계용). 매월 적재.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| YYYYMM | CHAR(6) PK | 기준월 |
| PRODUCT_CD | VARCHAR(20) PK | 제품코드 |
| MAT_CD | VARCHAR(20) PK | 자재코드 |
| STD_QTY | DECIMAL(18,4) | 표준사용량 |
| UNIT_PRICE | DECIMAL(18,2) | 자재 단가 |
| MAT_AMT | DECIMAL(18,2) | 재료비 (표준사용량 × 단가) |

```
샘플 데이터:

월       제품코드   자재코드    표준사용량  단가     재료비(억)
──────────────────────────────────────────────────────────
202412  HBM_001  MAT_X01    100.0    1,200   12.0
202412  HBM_001  MAT_X02    200.0      800   16.0
202412  HBM_001  MAT_X03    150.0      500    7.5
202501  HBM_001  MAT_X01    100.0    1,350   13.5  ← 단가 +12.5%
202501  HBM_001  MAT_X02    210.0      810   17.0  ← 사용량+5%, 단가+1.3%
202501  HBM_001  MAT_X03    150.0      510    7.65 ← 단가 +2.0%
```

---

## 4. Layer C: 소스시스템 이벤트 데이터

### 4.1 MES 이벤트 (EVT_MES)

> 장비 가동률, 수율 등 생산 지표 변동. 매월 적재.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| YYYYMM | CHAR(6) PK | 기준월 |
| EQUIP_CD | VARCHAR(20) PK | 장비코드 |
| METRIC_TYPE | VARCHAR(20) PK | 지표유형 (UTIL/YIELD/CT) |
| PREV_VALUE | DECIMAL(10,2) | 전월 값 |
| CURR_VALUE | DECIMAL(10,2) | 당월 값 |
| CHG_VALUE | DECIMAL(10,2) | 변동값 |
| CHG_RATE | DECIMAL(10,4) | 변동률 |

```
샘플 데이터:

월       장비코드      지표      전월    당월    변동
────────────────────────────────────────────────────
202501  ETCH_A01    UTIL     85.0   78.0   -7.0%p
202501  ETCH_A02    UTIL     88.0   86.0   -2.0%p
202501  DEP_B01     YIELD    94.0   93.5   -0.5%p
202501  DEP_B02     YIELD    95.0   94.8   -0.2%p
202501  PHOTO_C01   UTIL     90.0   89.5   -0.5%p
```

### 4.2 PLM 이벤트 (EVT_PLM)

> BOM 변경, 스펙 변경 이력. 매월 적재.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| EVENT_ID | VARCHAR(20) PK | 이벤트ID |
| YYYYMM | CHAR(6) | 기준월 |
| PRODUCT_CD | VARCHAR(20) | 제품코드 |
| CHG_TYPE | VARCHAR(20) | 변경유형 (BOM_CHG/SPEC_CHG/RECIPE_CHG) |
| CHG_DESC | VARCHAR(500) | 변경 내용 설명 |
| CHG_DATE | DATE | 변경 일자 |

```
샘플 데이터:

이벤트ID    월       제품코드   유형         설명
──────────────────────────────────────────────────────
PLM_001  202501  HBM_001  BOM_CHG    Wire_B 사용량 200→210 변경
PLM_002  202501  HBM_002  SPEC_CHG   패키지 두께 변경 (0.8→0.75mm)
```

### 4.3 구매 이벤트 (EVT_PURCHASE)

> 자재 단가 변동, 공급처 변경 등. 매월 적재.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| EVENT_ID | VARCHAR(20) PK | 이벤트ID |
| YYYYMM | CHAR(6) | 기준월 |
| MAT_CD | VARCHAR(20) | 자재코드 |
| CHG_TYPE | VARCHAR(20) | 변경유형 (PRICE_CHG/SUPPLIER_CHG) |
| PREV_VALUE | DECIMAL(18,2) | 변경 전 값 |
| CURR_VALUE | DECIMAL(18,2) | 변경 후 값 |
| CHG_RATE | DECIMAL(10,4) | 변동률 |
| CHG_REASON | VARCHAR(500) | 변동 사유 |

```
샘플 데이터:

이벤트ID    월       자재코드   유형          전값    후값    변동률    사유
────────────────────────────────────────────────────────────────────────
PUR_001  202501  MAT_X01  PRICE_CHG   1,200  1,350  +12.5%  원자재 가격 상승
PUR_002  202501  MAT_X02  PRICE_CHG     800    810   +1.3%  환율 변동
```

---

## 5. Layer D: 차이 계산 결과

### 5.1 차이 계산 결과 (CAL_VARIANCE)

> Python 차이 계산 엔진이 생성. 매월 신규 생성.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| VAR_ID | VARCHAR(30) PK | 차이 ID (자동생성) |
| YYYYMM | CHAR(6) | 기준월 |
| PRODUCT_CD | VARCHAR(20) | 제품코드 (NULL이면 제품군 레벨) |
| PRODUCT_GRP | VARCHAR(20) | 제품군 |
| PROC_CD | VARCHAR(20) | 공정코드 |
| CE_CD | VARCHAR(20) | 원가요소코드 |
| VAR_TYPE | VARCHAR(20) | 차이유형 |
| VAR_AMT | DECIMAL(18,2) | 차이금액 (억원) |
| VAR_RATE | DECIMAL(10,4) | 차이비율 |
| PREV_AMT | DECIMAL(18,2) | 전월 금액 |
| CURR_AMT | DECIMAL(18,2) | 당월 금액 |

```
VAR_TYPE (차이유형) 코드:

전공정:
  RATE_VAR    ── 배부율 차이 (R₁-R₀) × Q₁
  QTY_VAR     ── 배부량 차이 R₀ × (Q₁-Q₀)
  RATE_COST   ── 배부율차이 > 총비용 변동 효과
  RATE_BASE   ── 배부율차이 > 총배부기준량 변동 효과

후공정 재료비:
  PRICE_VAR   ── 단가 차이 (P₁-P₀) × Q₁
  USAGE_VAR   ── 사용량 차이 P₀ × (Q₁-Q₀)

후공정 가공비:
  RATE_VAR    ── 배부율 차이 (전공정과 동일)
  QTY_VAR     ── 배부량 차이 (전공정과 동일)
```

```
샘플 데이터:

차이ID                          월      제품군  제품코드   공정    요소     차이유형     금액(억)  비율
──────────────────────────────────────────────────────────────────────────────────────────────────
V202501_HBM_001_FE01_DEP_RV   202501  HBM   HBM_001  FE_01  CE_DEP  RATE_VAR    +10.5   +11.1%
V202501_HBM_001_FE01_DEP_QV   202501  HBM   HBM_001  FE_01  CE_DEP  QTY_VAR      +2.5   +2.6%
V202501_HBM_001_FE01_DEP_RC   202501  HBM   HBM_001  FE_01  CE_DEP  RATE_COST    +2.8   +3.0%
V202501_HBM_001_FE01_DEP_RB   202501  HBM   HBM_001  FE_01  CE_DEP  RATE_BASE    +7.7   +8.1%
V202501_HBM_001_BE01_MAT_PV   202501  HBM   HBM_001  BE_01  CE_MAT  PRICE_VAR    +4.2   +7.0%
V202501_HBM_001_BE01_MAT_UV   202501  HBM   HBM_001  BE_01  CE_MAT  USAGE_VAR    +1.8   +3.0%
V202501_DDR5_001_FE01_DEP_RV  202501  DDR5  DDR5_001 FE_01  CE_DEP  RATE_VAR   +15.1  +10.1%
```

### 5.2 차이 계산 검증 규칙

```
전공정 검증:
  배부율차이 + 배부량차이 = 총 원가 차이
  (R₁-R₀)×Q₁ + R₀×(Q₁-Q₀) = R₁Q₁ - R₀Q₀ ✓

  배부율차이 = 총비용변동효과 + 총배부기준변동효과
  (RATE_COST + RATE_BASE = RATE_VAR) ✓

후공정 재료비 검증:
  단가차이 + 사용량차이 = 총 재료비 차이
  Σ(P₁-P₀)×Q₁ + ΣP₀×(Q₁-Q₀) = Σ(P₁Q₁ - P₀Q₀) ✓
```

---

## 6. 프로토타입 샘플 데이터 생성 가이드

### 6.1 데이터 규모

| 항목 | 프로토타입 | 실제 |
|------|-----------|------|
| 제품군 | 4개 | ~10개 |
| 제품코드 | 8개 | 전공정100 / 후공정800 |
| 공정 | 8개 | 대공정10 / Step750 |
| 장비 | 7대 | ~3,000대 |
| 자재 | 5종 | 수천 종 |
| 원가요소 | 7종 | 30~50종 |
| 기간 | 6개월 (2024.08 ~ 2025.01) | 12개월+ |

### 6.2 시나리오 설계

프로토타입에서 검증할 시나리오:

```
시나리오 1: 전공정 배부율 상승 (일시적)
  ─ 원인: 식각 공정 장비 가동률 하락 (신규라인 초기)
  ─ 영향: HBM, DDR5, 낸드 동반 상승 (동일 배부기준)
  ─ 판정: 일시적, 2~3개월 내 정상화 예상

시나리오 2: 후공정 재료비 상승 (구조적)
  ─ 원인: Substrate 단가 인상 (+12.5%)
  ─ 영향: HBM 제품군에 집중
  ─ 판정: 구조적, 원자재 시황에 따른 상승

시나리오 3: 생산수량 변동에 따른 Mix 차이
  ─ 원인: HBM 생산비중 확대, 낸드 축소
  ─ 영향: 배부량 차이로 나타남
  ─ 판정: 의도된 변동 (전략적 Mix 변경)
```

### 6.3 데이터 생성 시 주의사항

```
1. 정합성: 배부율 × 배부량 = 배부액이 정확히 일치해야 함
2. 연속성: 6개월 데이터가 자연스러운 추이를 보여야 함
3. 검증 가능: 차이 분해 합계가 총 차이와 일치해야 함
4. 시나리오 반영: 위 3개 시나리오가 데이터에 녹아있어야 함
5. 이벤트 매칭: MES/PLM/구매 이벤트가 원가 변동 시점과 일치해야 함
```

---

## 7. 데이터 흐름 타이밍

```
[매월 마감 후 실행 순서]

T+0h: SAP CBO 원가계산 완료 (기존 프로세스)
T+1h: Step 1 — SAP → Oracle 스냅샷 추출 (Layer B)
T+2h: Step 2 — 소스시스템 → Oracle 이벤트 적재 (Layer C)
T+3h: Step 3 — Python 차이 계산 (Layer D 생성)
T+4h: Step 4 — Neo4j 그래프 갱신 (→ GRAPH_DB_SCHEMA.md 참조)
T+5h: Step 5 — LLM 해석 생성
T+6h: Step 6 — 보고서 자동 생성 + UI 조회 가능
```
