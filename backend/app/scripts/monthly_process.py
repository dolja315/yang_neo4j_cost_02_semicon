"""
월별 실행 프로세스 (Step 1~7 전체 실행)

실행 순서:
  Step 1: SAP → Oracle 스냅샷 복사 (프로토타입에서는 이미 적재됨)
  Step 2: 소스시스템 → Oracle 이벤트 적재 (프로토타입에서는 이미 적재됨)
  Step 3: Python 차이 계산
  Step 4: Neo4j 그래프 갱신
    4a: 상설 그래프 갱신
    4b: 차이 노드 생성
    4c: 이벤트 노드 생성
    4d: 규칙 기반 인과관계 연결
  Step 5: LLM 해석 생성
  Step 6: 보고서 자동 생성
  Step 7: UI 조회 가능 + 알림 발송
"""

import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.db.database import init_db, _async_session_factory
from app.db.neo4j_db import init_neo4j
from app.services.variance_calc import VarianceCalculator
from app.services.graph_builder import GraphBuilder
from app.services.rule_engine import RuleEngine
from app.services.evidence import EvidenceBuilder
from app.services.llm_engine import LLMEngine


async def run_monthly_process(yyyymm: str):
    """매월 마감 후 자동 실행 프로세스"""

    start_time = time.time()
    print(f"\n{'='*60}")
    print(f"  반도체 원가 차이분석 — 월별 실행 프로세스")
    print(f"  기준월: {yyyymm}")
    print(f"{'='*60}\n")

    # DB 초기화
    await init_db()
    await init_neo4j()

    async with _async_session_factory() as session:

        # ── Step 1~2: 데이터 적재 (프로토타입에서는 생략) ──
        print("[Step 1-2] 데이터 적재 (프로토타입 - 이미 완료)")

        # ── Step 3: 차이 계산 ──
        print("\n[Step 3] 차이 계산 시작...")
        calculator = VarianceCalculator(session)
        variances = await calculator.calculate_all(yyyymm)
        print(f"[Step 3] 완료: {len(variances)}건 생성")

        # ── Step 4a: 상설 그래프 갱신 ──
        print("\n[Step 4a] 상설 그래프 갱신...")
        builder = GraphBuilder(session)
        await builder.build_permanent_graph()

        # ── Step 4b: 차이 노드 생성 ──
        print("\n[Step 4b] 차이 노드 생성...")
        await builder.create_variance_nodes(yyyymm)

        # ── Step 4c: 이벤트 노드 생성 ──
        print("\n[Step 4c] 이벤트 노드 생성...")
        await builder.create_event_nodes(yyyymm)

        # ── Step 4d: 인과관계 연결 ──
        print("\n[Step 4d] 인과관계 규칙 엔진 실행...")
        rule_engine = RuleEngine()
        await rule_engine.execute_all_rules(yyyymm)

        # ── Step 5: LLM 해석 생성 ──
        print("\n[Step 5] LLM 해석 생성...")
        evidence_builder = EvidenceBuilder(session)
        llm_engine = LLMEngine(evidence_builder)
        interpretations = await llm_engine.interpret_all_variances(yyyymm)
        print(f"[Step 5] 완료: {len(interpretations)}건 해석")

        # ── Step 6: 보고서 자동 생성 ──
        print("\n[Step 6] 보고서 생성 (UI에서 조회)")

        # ── Step 7: 완료 ──
        elapsed = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"  전체 프로세스 완료! (소요시간: {elapsed:.1f}초)")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    yyyymm = sys.argv[1] if len(sys.argv) > 1 else "202501"
    asyncio.run(run_monthly_process(yyyymm))
