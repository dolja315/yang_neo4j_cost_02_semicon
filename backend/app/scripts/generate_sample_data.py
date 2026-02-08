"""
샘플 데이터 생성 스크립트 (SK하이닉스 경영진 관점 8개 제품군)
DATA_PREPARATION.md 기반 프로토타입용 데이터 생성

제품군 (8):
  1. HBM        — AI 가속기용 HBM (HBM3E → HBM4)
  2. 서버DRAM   — 데이터센터/서버 DRAM (DDR5 RDIMM/MRDIMM)
  3. CXL        — 차세대 메모리 확장 (CXL Type3)
  4. 모바일DRAM — 모바일 DRAM (LPDDR5X)
  5. PC DRAM    — PC/클라이언트 DRAM (DDR5 UDIMM)
  6. NAND       — NAND 칩 (고적층 4D NAND)
  7. SSD        — 스토리지 솔루션 (eSSD / UFS)
  8. CIS        — 이미지센서

시나리오:
  1. 전공정 배부율 상승 (일시적) — 식각 공정 장비 가동률 하락 (신규라인 초기)
  2. 후공정 재료비 상승 (구조적) — Substrate 단가 인상 (+12.5%)
  3. 생산 Mix 변동 — HBM/서버/CXL 확대, PC DRAM/NAND 축소

기간: 2024.08 ~ 2025.01 (6개월)

데이터 정합성 규칙:
  - 배부율 = 총비용(억원) × 10,000 / 총배부기준량
  - 배부액(억원) = 배부량 × 배부율 / 10,000
  - 재료비(억원) = 표준사용량 × 단가 / 10,000
"""

import asyncio
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import text
import app.db.database as database

import app.models.master       # noqa: F401
import app.models.snapshot     # noqa: F401
import app.models.event        # noqa: F401
import app.models.variance     # noqa: F401


# ═══════════════════════════════════════════════════════════════
# 상수
# ═══════════════════════════════════════════════════════════════
MONTHS = ["202408", "202409", "202410", "202411", "202412", "202501"]

PRODUCTS = {
    "HBM_001": "HBM",       "HBM_002": "HBM",
    "SVR_001": "서버DRAM",   "SVR_002": "서버DRAM",
    "CXL_001": "CXL",       "CXL_002": "CXL",
    "MBL_001": "모바일DRAM", "MBL_002": "모바일DRAM",
    "PC_001":  "PC DRAM",   "PC_002":  "PC DRAM",
    "NAND_001": "NAND",     "NAND_002": "NAND",
    "SSD_001": "SSD",       "SSD_002": "SSD",
    "CIS_001": "CIS",       "CIS_002": "CIS",
}


# ═══════════════════════════════════════════════════════════════
# 헬퍼 함수
# ═══════════════════════════════════════════════════════════════
def _r(v, d=2):
    return round(v, d)

def _rate(tc, tb):
    """배부율 = 총비용(억원) × 10,000 / 총배부기준량"""
    return _r(tc * 10000 / tb, 2)

def _amt(qty, rate):
    """배부액(억원) = 배부량 × 배부율 / 10,000"""
    return _r(qty * rate / 10000)

def _mat_amt(qty, price):
    """재료비(억원) = 표준사용량 × 단가 / 10,000"""
    return _r(qty * price / 10000)


# ═══════════════════════════════════════════════════════════════
# [RATE_DEF] 배부율 원천 — (proc, ce) → (unit, [(tc, tb) × 6개월])
#   시나리오 1: FE_01 202501에 tb 급감 → 배부율 급등
# ═══════════════════════════════════════════════════════════════
RATE_DEF = {
    # ── 전공정 FE_01 (ETCH) : 시나리오 1 핵심 ──
    ("FE_01", "CE_DEP"): ("만h", [
        (240, 100), (243, 101), (245, 100), (248, 99),
        (250, 100), (260, 93)]),
    ("FE_01", "CE_LAB"): ("만h", [
        (195, 100), (197, 101), (198, 100), (200, 99),
        (200, 100), (204, 93)]),
    ("FE_01", "CE_PWR"): ("만h", [
        (120, 100), (121, 101), (122, 100), (123, 99),
        (125, 100), (130, 93)]),
    # ── 전공정 FE_02 (증착) ──
    ("FE_02", "CE_DEP"): ("만h", [
        (150, 80), (152, 80), (155, 80), (157, 80),
        (160, 80), (165, 78.5)]),
    ("FE_02", "CE_LAB"): ("만h", [
        (75, 80), (76, 80), (78, 80), (79, 80),
        (82, 80), (85, 78.5)]),
    ("FE_02", "CE_PWR"): ("만h", [
        (60, 80), (61, 80), (62, 80), (64, 80),
        (66, 80), (68, 78.5)]),
    # ── 전공정 FE_03 (포토) ──
    ("FE_03", "CE_DEP"): ("만h", [
        (100, 75), (102, 75), (104, 75), (106, 75),
        (110, 75), (113, 74)]),
    ("FE_03", "CE_LAB"): ("만h", [
        (55, 75), (56, 75), (57, 75), (59, 75),
        (62, 75), (64, 74)]),
    ("FE_03", "CE_PWR"): ("만h", [
        (45, 75), (46, 75), (47, 75), (49, 75),
        (52, 75), (54, 74)]),
    # ── 전공정 FE_04 (확산) ──
    ("FE_04", "CE_DEP"): ("만h", [
        (75, 90), (76, 90), (77, 90), (79, 90),
        (82, 90), (84, 88)]),
    ("FE_04", "CE_LAB"): ("만h", [
        (32, 90), (33, 90), (33, 90), (35, 90),
        (37, 90), (38, 88)]),
    ("FE_04", "CE_PWR"): ("만h", [
        (22, 90), (23, 90), (23, 90), (24, 90),
        (25, 90), (27, 88)]),
    # ── 전공정 FE_05 (CMP) ──
    ("FE_05", "CE_DEP"): ("만h", [
        (50, 85), (51, 85), (52, 85), (53, 85),
        (55, 85), (57, 83)]),
    ("FE_05", "CE_LAB"): ("만h", [
        (22, 85), (23, 85), (23, 85), (24, 85),
        (26, 85), (27, 83)]),
    ("FE_05", "CE_PWR"): ("만h", [
        (16, 85), (16, 85), (17, 85), (17, 85),
        (18, 85), (20, 83)]),
    # ── 후공정 BE_02 (가공) ──
    ("BE_02", "CE_DEP"): ("만h", [
        (78, 50), (79, 50), (80, 50), (82, 50),
        (84, 50), (86, 49)]),
    ("BE_02", "CE_LAB"): ("만h", [
        (38, 50), (39, 50), (40, 50), (41, 50),
        (42, 50), (44, 49)]),
    ("BE_02", "CE_PWR"): ("만h", [
        (18, 50), (18, 50), (19, 50), (19, 50),
        (20, 50), (22, 49)]),
    # ── 후공정 BE_03 (테스트) ──
    ("BE_03", "CE_DEP"): ("개", [
        (40, 60), (41, 60), (42, 60), (43, 60),
        (45, 60), (47, 59)]),
    ("BE_03", "CE_LAB"): ("개", [
        (26, 60), (27, 60), (27, 60), (28, 60),
        (30, 60), (32, 59)]),
    ("BE_03", "CE_PWR"): ("개", [
        (20, 60), (21, 60), (21, 60), (22, 60),
        (24, 60), (26, 59)]),
}

# 공정별 원가요소 (모든 공정에 인건비·전력비 배부)
PROC_CES = {
    "FE_01": ["CE_DEP", "CE_LAB", "CE_PWR"],
    "FE_02": ["CE_DEP", "CE_LAB", "CE_PWR"],
    "FE_03": ["CE_DEP", "CE_LAB", "CE_PWR"],
    "FE_04": ["CE_DEP", "CE_LAB", "CE_PWR"],
    "FE_05": ["CE_DEP", "CE_LAB", "CE_PWR"],
    "BE_02": ["CE_DEP", "CE_LAB", "CE_PWR"],
    "BE_03": ["CE_DEP", "CE_LAB", "CE_PWR"],
}


# ═══════════════════════════════════════════════════════════════
# [QTY] 배부량 자동 계산 — 기준 비중 + 월별 성장률
# ═══════════════════════════════════════════════════════════════

# 기준 비중 (%, 공정별 총배부기준 대비 제품 점유율)
_BASE_PCT = {
    "HBM_001": 13.0, "HBM_002":  9.5,
    "SVR_001": 11.0, "SVR_002":  7.5,
    "CXL_001":  2.5, "CXL_002":  1.5,
    "MBL_001":  9.5, "MBL_002":  7.0,
    "PC_001":   8.0, "PC_002":   5.5,
    "NAND_001": 7.0, "NAND_002": 4.5,
    "SSD_001":  4.0, "SSD_002":  2.5,
    "CIS_001":  4.5, "CIS_002":  2.5,
}  # sum = 100.0

# 월별 성장 가감 (비중 포인트, 시나리오 3 반영)
#                                08    09    10    11    12    01
_GROWTH = {
    "HBM_001":  [ 0.0,  0.1,  0.3,  0.5,  0.8,  1.5],
    "HBM_002":  [ 0.0,  0.2,  0.4,  0.8,  1.2,  2.5],
    "SVR_001":  [ 0.0,  0.1,  0.2,  0.3,  0.4,  0.8],
    "SVR_002":  [ 0.0,  0.1,  0.2,  0.4,  0.5,  1.0],
    "CXL_001":  [ 0.0,  0.1,  0.2,  0.3,  0.4,  0.7],
    "CXL_002":  [ 0.0,  0.1,  0.2,  0.3,  0.5,  0.8],
    "MBL_001":  [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    "MBL_002":  [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    "PC_001":   [ 0.0,  0.0, -0.2, -0.4, -0.6, -1.2],
    "PC_002":   [ 0.0,  0.0, -0.1, -0.3, -0.5, -0.8],
    "NAND_001": [ 0.0,  0.0, -0.2, -0.4, -0.6, -1.5],
    "NAND_002": [ 0.0, -0.1, -0.2, -0.3, -0.5, -1.0],
    "SSD_001":  [ 0.0,  0.0,  0.0,  0.1,  0.1,  0.2],
    "SSD_002":  [ 0.0,  0.0,  0.0,  0.1,  0.1,  0.2],
    "CIS_001":  [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    "CIS_002":  [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
}

def _compute_qty_def():
    """배부량 자동 계산: 기준 비중 + 성장률 → 총배부기준량에 정규화"""
    qty_def = {}
    for proc in PROC_CES:
        qty_def[proc] = {}
        first_ce = PROC_CES[proc][0]
        _, month_data = RATE_DEF[(proc, first_ce)]
        for i in range(6):
            tb = month_data[i][1]  # 총배부기준량
            raw = {}
            for prod in PRODUCTS:
                raw[prod] = max(_BASE_PCT[prod] + _GROWTH[prod][i], 0.1)
            total_raw = sum(raw.values())
            for prod in PRODUCTS:
                qty = raw[prod] / total_raw * tb
                qty_def[proc].setdefault(prod, []).append(_r(qty, 1))
    return qty_def

QTY_DEF = _compute_qty_def()


# ═══════════════════════════════════════════════════════════════
# [BOM] BOM 원천 — 자재 단가 + 제품별 사용량
#   시나리오 2: MAT_X01(Substrate) 단가 구조적 상승
# ═══════════════════════════════════════════════════════════════

# 자재 단가 추이 (6개월) — 반도체 재료비 비중 현실화 (×1.6)
_MAT_PRICES = {
    "MAT_X01": [1760, 1792, 1824, 1856, 1920, 2160],  # Substrate +12.5% 급등
    "MAT_X02": [1248, 1256, 1264, 1272, 1280, 1296],   # Wire/Bump
    "MAT_X03": [ 768,  776,  784,  792,  800,  816],   # Mold
    "MAT_X04": [3520, 3552, 3584, 3616, 3680, 3760],   # NAND Die
    "MAT_X05": [ 560,  563,  568,  573,  576,  584],   # Glass Lid
}

# BOM 수량 (제품별 자재별 6개월, PLM 변경 반영)
_BOM_QTY = {
    # ── HBM ──
    "HBM_001": {"MAT_X01": [100]*6, "MAT_X02": [200]*5+[210], "MAT_X03": [150]*6},
    "HBM_002": {"MAT_X01": [90]*6,  "MAT_X02": [180]*5+[185], "MAT_X03": [140]*6},
    # ── 서버DRAM ──
    "SVR_001": {"MAT_X01": [80]*6,  "MAT_X02": [160]*6, "MAT_X03": [120]*6},
    "SVR_002": {"MAT_X01": [70]*6,  "MAT_X02": [140]*6, "MAT_X03": [110]*6},
    # ── CXL ──
    "CXL_001": {"MAT_X01": [85]*6,  "MAT_X02": [170]*6, "MAT_X03": [125]*6},
    "CXL_002": {"MAT_X01": [75]*6,  "MAT_X02": [150]*6, "MAT_X03": [115]*6},
    # ── 모바일DRAM (소형, Mold 없음) ──
    "MBL_001": {"MAT_X01": [60]*6,  "MAT_X02": [120]*6},
    "MBL_002": {"MAT_X01": [50]*6,  "MAT_X02": [100]*6},
    # ── PC DRAM ──
    "PC_001":  {"MAT_X01": [70]*6,  "MAT_X02": [140]*6, "MAT_X03": [100]*6},
    "PC_002":  {"MAT_X01": [60]*6,  "MAT_X02": [120]*6, "MAT_X03": [90]*6},
    # ── NAND (소형 패키지) ──
    "NAND_001": {"MAT_X01": [50]*6, "MAT_X02": [100]*6},
    "NAND_002": {"MAT_X01": [45]*6, "MAT_X02": [90]*6},
    # ── SSD (NAND Die 포함) ──
    "SSD_001": {"MAT_X01": [40]*6,  "MAT_X03": [80]*6,  "MAT_X04": [20]*6},
    "SSD_002": {"MAT_X01": [30]*6,  "MAT_X03": [60]*6,  "MAT_X04": [15]*6},
    # ── CIS (Glass Lid 포함) ──
    "CIS_001": {"MAT_X01": [55]*6,  "MAT_X02": [110]*6, "MAT_X05": [50]*6},
    "CIS_002": {"MAT_X01": [45]*6,  "MAT_X02": [90]*6,  "MAT_X05": [40]*6},
}

# BOM_DEF 생성 (기존 형식 호환)
BOM_DEF = {}
for _prod, _mats in _BOM_QTY.items():
    for _mat_cd, _qty_list in _mats.items():
        BOM_DEF[(_prod, _mat_cd)] = [
            (_qty_list[i], _MAT_PRICES[_mat_cd][i]) for i in range(6)
        ]


# ═══════════════════════════════════════════════════════════════
# [EVENT] 이벤트 데이터
# ═══════════════════════════════════════════════════════════════
MES_EVENTS = [
    # 202411: 안정
    ("202411", "ETCH_A01", "UTIL",  86.0, 85.0, -1.0, -0.0116),
    ("202411", "ETCH_A02", "UTIL",  88.0, 88.0,  0.0,  0.0),
    ("202411", "DEP_B01",  "YIELD", 94.5, 94.0, -0.5, -0.0053),
    ("202411", "DEP_B02",  "YIELD", 95.0, 95.0,  0.0,  0.0),
    ("202411", "PHOTO_C01","UTIL",  90.0, 90.0,  0.0,  0.0),
    # 202412: 안정
    ("202412", "ETCH_A01", "UTIL",  85.0, 85.0,  0.0,  0.0),
    ("202412", "ETCH_A02", "UTIL",  88.0, 88.0,  0.0,  0.0),
    ("202412", "DEP_B01",  "YIELD", 94.0, 94.0,  0.0,  0.0),
    ("202412", "DEP_B02",  "YIELD", 95.0, 95.0,  0.0,  0.0),
    ("202412", "PHOTO_C01","UTIL",  90.0, 90.0,  0.0,  0.0),
    # 202501: 시나리오 1 — 장비 가동률 하락
    ("202501", "ETCH_A01", "UTIL",  85.0, 78.0, -7.0, -0.0824),
    ("202501", "ETCH_A02", "UTIL",  88.0, 86.0, -2.0, -0.0227),
    ("202501", "DEP_B01",  "YIELD", 94.0, 93.5, -0.5, -0.0053),
    ("202501", "DEP_B02",  "YIELD", 95.0, 94.8, -0.2, -0.0021),
    ("202501", "PHOTO_C01","UTIL",  90.0, 89.5, -0.5, -0.0056),
]

PLM_EVENTS = [
    ("PLM_001", "202501", "HBM_001", "BOM_CHG",
     "Wire_B 사용량 200→210 변경", date(2025, 1, 10)),
    ("PLM_002", "202501", "HBM_002", "SPEC_CHG",
     "패키지 두께 변경 (0.8→0.75mm)", date(2025, 1, 15)),
    ("PLM_003", "202501", "HBM_002", "BOM_CHG",
     "Wire_B 사용량 180→185 변경", date(2025, 1, 12)),
]

PURCHASE_EVENTS = [
    ("PUR_001", "202501", "MAT_X01", "PRICE_CHG",
     1920, 2160, 0.125, "원자재 가격 상승 (구조적)"),
    ("PUR_002", "202501", "MAT_X02", "PRICE_CHG",
     1280, 1296, 0.0125, "환율 변동"),
    ("PUR_003", "202501", "MAT_X03", "PRICE_CHG",
     800, 816, 0.02, "원자재 소폭 인상"),
    ("PUR_004", "202501", "MAT_X04", "PRICE_CHG",
     3680, 3760, 0.0217, "NAND 다이 가격 소폭 인상"),
    ("PUR_005", "202501", "MAT_X05", "PRICE_CHG",
     576, 584, 0.0139, "유리 기판 소폭 인상"),
]


# ═══════════════════════════════════════════════════════════════
# 메인 함수
# ═══════════════════════════════════════════════════════════════
async def generate_all():
    """전체 샘플 데이터 생성"""
    await database.init_db()

    async with database._async_session_factory() as session:
        await _clear_all_tables(session)
        print("=" * 60)

        await _insert_master_data(session)
        cnt = await _insert_snapshot_data(session)
        await _insert_event_data(session)
        var_cnt = await _insert_variance_data(session)

        await session.commit()
        print("=" * 60)
        print(f"[완료] 전체 샘플 데이터 생성 완료")
        print(f"  - 스냅샷: {cnt}건, 차이분석: {var_cnt}건")
        print("=" * 60)

        await _print_summary(session)


# ═══════════════════════════════════════════════════════════════
# 테이블 초기화
# ═══════════════════════════════════════════════════════════════
async def _clear_all_tables(session):
    """기존 테이블 DROP 후 재생성"""
    async with database._engine.begin() as conn:
        await conn.run_sync(database.Base.metadata.drop_all)
        await conn.run_sync(database.Base.metadata.create_all)
    print("[초기화] 테이블 재생성 완료")


# ═══════════════════════════════════════════════════════════════
# Layer A: 마스터 데이터
# ═══════════════════════════════════════════════════════════════
async def _insert_master_data(session):
    # ── 제품 마스터 (8제품군 × 2 = 16개) ──
    products = [
        ("HBM_001",  "HBM",       "HBM3E 8Hi",           "FE", "Y"),
        ("HBM_002",  "HBM",       "HBM3E 12Hi",          "FE", "Y"),
        ("SVR_001",  "서버DRAM",   "DDR5 RDIMM 64GB",     "FE", "Y"),
        ("SVR_002",  "서버DRAM",   "DDR5 MRDIMM 128GB",   "FE", "Y"),
        ("CXL_001",  "CXL",       "CXL Type3 128GB",     "FE", "Y"),
        ("CXL_002",  "CXL",       "CXL Type3 256GB",     "FE", "Y"),
        ("MBL_001",  "모바일DRAM", "LPDDR5X 16GB",        "FE", "Y"),
        ("MBL_002",  "모바일DRAM", "LPDDR5X 12GB",        "FE", "Y"),
        ("PC_001",   "PC DRAM",   "DDR5 16GB UDIMM",     "FE", "Y"),
        ("PC_002",   "PC DRAM",   "DDR5 32GB UDIMM",     "FE", "Y"),
        ("NAND_001", "NAND",      "4D NAND 238L",        "FE", "Y"),
        ("NAND_002", "NAND",      "4D NAND 321L",        "FE", "Y"),
        ("SSD_001",  "SSD",       "eSSD PE8110",         "BE", "Y"),
        ("SSD_002",  "SSD",       "UFS 4.1 256GB",       "BE", "Y"),
        ("CIS_001",  "CIS",       "50M Pixel CIS",       "FE", "Y"),
        ("CIS_002",  "CIS",       "200M Pixel CIS",      "FE", "Y"),
    ]
    for p in products:
        await session.execute(
            text("INSERT INTO mst_product VALUES (:a,:b,:c,:d,:e)"),
            dict(zip("abcde", p)))

    # ── 공정 마스터 (전공정 5 + 후공정 3 = 8개) ──
    processes = [
        ("FE_01", "전공정_식각",   "FE", "ETCH",  "ALLOC",  "ST"),
        ("FE_02", "전공정_증착",   "FE", "DEP",   "ALLOC",  "ST"),
        ("FE_03", "전공정_포토",   "FE", "PHOTO", "ALLOC",  "ST"),
        ("FE_04", "전공정_확산",   "FE", "DIFF",  "ALLOC",  "ST"),
        ("FE_05", "전공정_CMP",    "FE", "CMP",   "ALLOC",  "ST"),
        ("BE_01", "후공정_조립",   "BE", "ASSY",  "DIRECT", "BOM"),
        ("BE_02", "후공정_가공",   "BE", "ASSY",  "ALLOC",  "ST"),
        ("BE_03", "후공정_테스트", "BE", "TEST",  "ALLOC",  "QTY"),
    ]
    for p in processes:
        await session.execute(
            text("INSERT INTO mst_process VALUES (:a,:b,:c,:d,:e,:f)"),
            dict(zip("abcdef", p)))

    # ── 장비 마스터 (7대) ──
    equipments = [
        ("ETCH_A01",  "Etcher #01",      "FE_01", "FAB3"),
        ("ETCH_A02",  "Etcher #02",      "FE_01", "FAB3"),
        ("DEP_B01",   "CVD #01",         "FE_02", "FAB3"),
        ("DEP_B02",   "CVD #02",         "FE_02", "FAB3"),
        ("PHOTO_C01", "Scanner #01",     "FE_03", "FAB3"),
        ("ASSY_D01",  "Die Bonder #01",  "BE_01", "PKG1"),
        ("TEST_E01",  "Tester #01",      "BE_03", "PKG1"),
    ]
    for e in equipments:
        await session.execute(
            text("INSERT INTO mst_equipment VALUES (:a,:b,:c,:d)"),
            dict(zip("abcd", e)))

    # ── 자재 마스터 (7종) ──
    materials = [
        ("MAT_X01", "Substrate_A",   "SUBSTRATE",  "BE"),
        ("MAT_X02", "Wire_B",        "WIRE",       "BE"),
        ("MAT_X03", "Mold_Compound", "MOLD",       "BE"),
        ("MAT_X04", "NAND_Die",      "COMPONENT",  "BE"),
        ("MAT_X05", "Glass_Lid",     "GLASS",      "BE"),
        ("MAT_G01", "Etch_Gas_1",    "GAS",        "FE"),
        ("MAT_G02", "Dep_Gas_1",     "GAS",        "FE"),
    ]
    for m in materials:
        await session.execute(
            text("INSERT INTO mst_material VALUES (:a,:b,:c,:d)"),
            dict(zip("abcd", m)))

    # ── 원가요소 마스터 (7종) ──
    cost_elements = [
        ("CE_DEP", "감가상각비",  "FIXED"),
        ("CE_LAB", "인건비",     "FIXED"),
        ("CE_PWR", "전력비",     "VARIABLE"),
        ("CE_MAT", "재료비",     "VARIABLE"),
        ("CE_MNT", "수선유지비",  "VARIABLE"),
        ("CE_GAS", "기료비",     "VARIABLE"),
        ("CE_OTH", "기타경비",   "MIXED"),
    ]
    for c in cost_elements:
        await session.execute(
            text("INSERT INTO mst_cost_element VALUES (:a,:b,:c)"),
            dict(zip("abc", c)))

    print(f"[Layer A] 마스터: 제품 {len(products)}, 공정 {len(processes)}, "
          f"장비 {len(equipments)}, 자재 {len(materials)}, 원가요소 {len(cost_elements)}")


# ═══════════════════════════════════════════════════════════════
# Layer B: SAP 스냅샷 데이터
# ═══════════════════════════════════════════════════════════════
async def _insert_snapshot_data(session) -> int:
    total_cnt = 0

    # ── 1) SNP_ALLOC_RATE (배부율 스냅샷) ──
    rate_cnt = 0
    rate_cache = {}

    for (proc, ce), (unit, month_data) in RATE_DEF.items():
        for i, month in enumerate(MONTHS):
            tc, tb = month_data[i]
            r = _rate(tc, tb)
            rate_cache[(proc, ce, month)] = r
            await session.execute(
                text("INSERT INTO snp_alloc_rate VALUES "
                     "(:ym,:proc,:ce,:tc,:tb,:unit,:rate)"),
                {"ym": month, "proc": proc, "ce": ce,
                 "tc": tc, "tb": tb, "unit": unit, "rate": r})
            rate_cnt += 1

    # ── 2) SNP_ALLOC_RESULT + SNP_COST_RESULT ──
    alloc_cnt = 0
    cost_cnt = 0
    cost_map = {}

    for proc, prod_data in QTY_DEF.items():
        ces = PROC_CES[proc]
        for prod, qty_list in prod_data.items():
            for i, month in enumerate(MONTHS):
                qty = qty_list[i]
                for ce in ces:
                    r = rate_cache.get((proc, ce, month))
                    if r is None:
                        continue
                    a = _amt(qty, r)

                    await session.execute(
                        text("INSERT INTO snp_alloc_result VALUES "
                             "(:ym,:prod,:proc,:ce,:qty,:amt)"),
                        {"ym": month, "prod": prod, "proc": proc,
                         "ce": ce, "qty": qty, "amt": a})
                    alloc_cnt += 1

                    key = (month, prod, proc, ce)
                    cost_map[key] = cost_map.get(key, 0) + a

    # ── 3) SNP_BOM ──
    bom_cnt = 0
    bom_cost_map = {}

    for (prod, mat), month_data in BOM_DEF.items():
        for i, month in enumerate(MONTHS):
            qty, price = month_data[i]
            ma = _mat_amt(qty, price)
            await session.execute(
                text("INSERT INTO snp_bom VALUES "
                     "(:ym,:prod,:mat,:qty,:price,:amt)"),
                {"ym": month, "prod": prod, "mat": mat,
                 "qty": qty, "price": price, "amt": ma})
            bom_cnt += 1

            bom_key = (month, prod)
            bom_cost_map[bom_key] = bom_cost_map.get(bom_key, 0) + ma

    # BOM 합계 → 원가결과 (BE_01, CE_MAT)
    for (month, prod), total_ma in bom_cost_map.items():
        key = (month, prod, "BE_01", "CE_MAT")
        cost_map[key] = _r(total_ma)

    # ── 4) SNP_COST_RESULT ──
    for (month, prod, proc, ce), amt in cost_map.items():
        await session.execute(
            text("INSERT INTO snp_cost_result VALUES "
                 "(:ym,:prod,:proc,:ce,:amt)"),
            {"ym": month, "prod": prod, "proc": proc,
             "ce": ce, "amt": _r(amt)})
        cost_cnt += 1

    total_cnt = rate_cnt + alloc_cnt + bom_cnt + cost_cnt
    print(f"[Layer B] 스냅샷: 배부율 {rate_cnt}, 배부결과 {alloc_cnt}, "
          f"BOM {bom_cnt}, 원가결과 {cost_cnt}")
    return total_cnt


# ═══════════════════════════════════════════════════════════════
# Layer C: 소스시스템 이벤트 데이터
# ═══════════════════════════════════════════════════════════════
async def _insert_event_data(session):
    for e in MES_EVENTS:
        await session.execute(
            text("INSERT INTO evt_mes VALUES (:a,:b,:c,:d,:e,:f,:g)"),
            dict(zip("abcdefg", e)))

    for e in PLM_EVENTS:
        await session.execute(
            text("INSERT INTO evt_plm VALUES (:a,:b,:c,:d,:e,:f)"),
            dict(zip("abcdef", e)))

    for e in PURCHASE_EVENTS:
        await session.execute(
            text("INSERT INTO evt_purchase VALUES (:a,:b,:c,:d,:e,:f,:g,:h)"),
            dict(zip("abcdefgh", e)))

    print(f"[Layer C] 이벤트: MES {len(MES_EVENTS)}, "
          f"PLM {len(PLM_EVENTS)}, 구매 {len(PURCHASE_EVENTS)}")


# ═══════════════════════════════════════════════════════════════
# Layer D: 차이 계산 결과 (202501 vs 202412)
# ═══════════════════════════════════════════════════════════════
async def _insert_variance_data(session) -> int:
    curr_m, prev_m = "202501", "202412"
    ci, pi = 5, 4
    variances = []

    # ── 1) 전공정(FE) + 후공정 가공비(BE_02, BE_03): 배부율·배부량 차이 ──
    for proc, prod_data in QTY_DEF.items():
        ces = PROC_CES[proc]
        is_fe = proc.startswith("FE")

        for prod, qty_list in prod_data.items():
            Q0, Q1 = qty_list[pi], qty_list[ci]
            grp = PRODUCTS[prod]

            for ce in ces:
                R0 = _rate_cache_get(proc, ce, pi)
                R1 = _rate_cache_get(proc, ce, ci)
                if R0 is None or R1 is None:
                    continue

                prev_amt = _amt(Q0, R0)
                curr_amt = _amt(Q1, R1)

                rate_var = _r((R1 - R0) * Q1 / 10000)
                qty_var = _r(R0 * (Q1 - Q0) / 10000)

                vid = f"V{curr_m}_{prod}_{proc}_{ce}"

                variances.append(_make_var(
                    f"{vid}_RV", curr_m, prod, grp, proc, ce,
                    "RATE_VAR", rate_var, prev_amt, curr_amt))
                variances.append(_make_var(
                    f"{vid}_QV", curr_m, prod, grp, proc, ce,
                    "QTY_VAR", qty_var, prev_amt, curr_amt))

                if is_fe:
                    _, mdata = RATE_DEF[(proc, ce)]
                    C0, B0 = mdata[pi]
                    C1, B1 = mdata[ci]

                    rate_cost = _r((C1 - C0) * Q1 / B0)
                    rate_base = _r(rate_var - rate_cost)

                    variances.append(_make_var(
                        f"{vid}_RC", curr_m, prod, grp, proc, ce,
                        "RATE_COST", rate_cost, prev_amt, curr_amt))
                    variances.append(_make_var(
                        f"{vid}_RB", curr_m, prod, grp, proc, ce,
                        "RATE_BASE", rate_base, prev_amt, curr_amt))

    # ── 2) 후공정 재료비(BE_01): 단가·사용량 차이 ──
    bom_by_prod = {}
    for (prod, mat), mdata in BOM_DEF.items():
        bom_by_prod.setdefault(prod, []).append((mat, mdata))

    for prod, items in bom_by_prod.items():
        grp = PRODUCTS[prod]
        total_price_var = 0.0
        total_usage_var = 0.0
        prev_total = 0.0
        curr_total = 0.0

        for mat, mdata in items:
            Q0, P0 = mdata[pi]
            Q1, P1 = mdata[ci]
            total_price_var += (P1 - P0) * Q1 / 10000
            total_usage_var += P0 * (Q1 - Q0) / 10000
            prev_total += _mat_amt(Q0, P0)
            curr_total += _mat_amt(Q1, P1)

        total_price_var = _r(total_price_var)
        total_usage_var = _r(total_usage_var)
        prev_total = _r(prev_total)
        curr_total = _r(curr_total)

        vid = f"V{curr_m}_{prod}_BE01_MAT"

        variances.append(_make_var(
            f"{vid}_PV", curr_m, prod, grp, "BE_01", "CE_MAT",
            "PRICE_VAR", total_price_var, prev_total, curr_total))
        variances.append(_make_var(
            f"{vid}_UV", curr_m, prod, grp, "BE_01", "CE_MAT",
            "USAGE_VAR", total_usage_var, prev_total, curr_total))

    # ── DB 저장 ──
    for v in variances:
        await session.execute(
            text("INSERT INTO cal_variance VALUES "
                 "(:var_id,:yyyymm,:product_cd,:product_grp,:proc_cd,:ce_cd,"
                 ":var_type,:var_amt,:var_rate,:prev_amt,:curr_amt)"),
            v)

    print(f"[Layer D] 차이분석: {len(variances)}건 (202501 vs 202412)")
    return len(variances)


def _rate_cache_get(proc, ce, month_idx):
    key = (proc, ce)
    if key not in RATE_DEF:
        return None
    _, mdata = RATE_DEF[key]
    tc, tb = mdata[month_idx]
    return _rate(tc, tb)


def _make_var(var_id, yyyymm, prod, grp, proc, ce, var_type, var_amt, prev_amt, curr_amt):
    var_rate = _r(var_amt / prev_amt, 4) if prev_amt != 0 else 0.0
    return {
        "var_id": var_id, "yyyymm": yyyymm,
        "product_cd": prod, "product_grp": grp,
        "proc_cd": proc, "ce_cd": ce,
        "var_type": var_type, "var_amt": _r(var_amt),
        "var_rate": var_rate,
        "prev_amt": _r(prev_amt), "curr_amt": _r(curr_amt),
    }


# ═══════════════════════════════════════════════════════════════
# 요약 출력
# ═══════════════════════════════════════════════════════════════
async def _print_summary(session):
    tables = [
        ("mst_product", "제품 마스터"),
        ("mst_process", "공정 마스터"),
        ("mst_equipment", "장비 마스터"),
        ("mst_material", "자재 마스터"),
        ("mst_cost_element", "원가요소 마스터"),
        ("snp_alloc_rate", "배부율 스냅샷"),
        ("snp_alloc_result", "배부결과 스냅샷"),
        ("snp_cost_result", "원가결과 스냅샷"),
        ("snp_bom", "BOM 스냅샷"),
        ("evt_mes", "MES 이벤트"),
        ("evt_plm", "PLM 이벤트"),
        ("evt_purchase", "구매 이벤트"),
        ("cal_variance", "차이분석 결과"),
    ]
    print("\n[데이터 요약]")
    print("-" * 45)
    for table, label in tables:
        result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
        cnt = result.scalar()
        print(f"  {label:20s} ({table:22s}): {cnt:>5}건")
    print("-" * 45)


# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    asyncio.run(generate_all())
