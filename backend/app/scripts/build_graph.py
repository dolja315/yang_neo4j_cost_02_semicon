"""
Neo4j 그래프 DB 구축 스크립트 (독립 실행)

PostgreSQL의 샘플 데이터를 기반으로 Neo4j 그래프를 구축한다.
  Step 4a: 상설 그래프 (Permanent Graph) — 마스터 노드 + 구조적 관계
  Step 4b: 차이 노드 (Variance) 생성 — 202501 기준
  Step 4c: 이벤트 노드 (Event) 생성 — MES / PLM / PURCHASE
  Step 4d: 인과관계 연결 — Rule 1~6 실행

실행 방법:
  cd backend
  $env:PYTHONIOENCODING="utf-8"; $env:PYTHONUTF8="1"
  python -m app.scripts.build_graph
"""

import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# 모델 import (Base.metadata에 테이블 등록)
import app.models.master       # noqa: F401
import app.models.snapshot     # noqa: F401
import app.models.event        # noqa: F401
import app.models.variance     # noqa: F401

import app.db.database as database
from app.db.neo4j_db import init_neo4j, close_neo4j, run_query
from app.services.graph_builder import GraphBuilder
from app.services.rule_engine import RuleEngine


YYYYMM = "202501"


async def build_graph():
    """Neo4j 그래프 구축 메인"""
    start = time.time()

    print()
    print("=" * 65)
    print("  Neo4j 그래프 DB 구축")
    print(f"  기준월: {YYYYMM}")
    print("=" * 65)
    print()

    # ── 1. DB 초기화 ──
    print("[Init] PostgreSQL 초기화...")
    await database.init_db()

    print("[Init] Neo4j 초기화...")
    await init_neo4j()

    async with database._async_session_factory() as session:
        builder = GraphBuilder(session)

        # ── 2. 기존 그래프 삭제 ──
        print()
        print("[Step 0] 기존 그래프 데이터 초기화...")
        await builder.clear_graph()

        # ── 3. Step 4a: 상설 그래프 구축 ──
        print()
        print("[Step 4a] 상설 그래프 구축 (노드 + 관계)...")
        await builder.build_permanent_graph()

        # ── 4. Step 4b: 차이 노드 생성 ──
        print()
        print(f"[Step 4b] 차이 노드 생성 ({YYYYMM})...")
        await builder.create_variance_nodes(YYYYMM)

        # ── 5. Step 4c: 이벤트 노드 생성 ──
        print()
        print(f"[Step 4c] 이벤트 노드 생성 ({YYYYMM})...")
        await builder.create_event_nodes(YYYYMM)

        # ── 6. Step 4d: 인과관계 규칙 엔진 ──
        print()
        print(f"[Step 4d] 인과관계 규칙 엔진 실행 ({YYYYMM})...")
        rule_engine = RuleEngine()
        await rule_engine.execute_all_rules(YYYYMM)

    # ── 7. 검증 및 통계 ──
    print()
    print("=" * 65)
    print("  그래프 구축 결과 요약")
    print("=" * 65)
    await _print_graph_stats()

    elapsed = time.time() - start
    print()
    print(f"  총 소요시간: {elapsed:.1f}초")
    print("=" * 65)

    await close_neo4j()


async def _print_graph_stats():
    """Neo4j 노드/관계 통계 출력"""

    # 노드 레이블별 카운트
    node_labels = [
        "ProductGroup", "Product", "Process", "ProcessGroup",
        "Equipment", "Material", "CostElement", "AllocBase",
        "Variance", "Event",
    ]
    print()
    print("  [노드 통계]")
    print("  " + "-" * 45)
    total_nodes = 0
    for label in node_labels:
        rows = await run_query(f"MATCH (n:{label}) RETURN count(n) AS cnt")
        cnt = rows[0]["cnt"] if rows else 0
        total_nodes += cnt
        print(f"    {label:20s}: {cnt:>5}개")
    print("  " + "-" * 45)
    print(f"    {'총 노드 수':20s}: {total_nodes:>5}개")

    # 관계 유형별 카운트
    rel_types = [
        "CONTAINS", "COST_AT", "HAS_SUBPROCESS", "HAS_EQUIPMENT",
        "COST_COMPOSED_OF", "ALLOCATED_BY", "USES_MATERIAL", "CONSUMES_GAS",
        "OCCURS_AT", "OCCURS_IN", "RELATES_TO", "INVOLVES",
        "CAUSED_BY", "EVIDENCED_BY", "SPREADS_TO", "SIMILAR_TO",
    ]
    print()
    print("  [관계 통계]")
    print("  " + "-" * 45)
    total_rels = 0
    for rtype in rel_types:
        rows = await run_query(f"MATCH ()-[r:{rtype}]->() RETURN count(r) AS cnt")
        cnt = rows[0]["cnt"] if rows else 0
        total_rels += cnt
        if cnt > 0:
            print(f"    {rtype:20s}: {cnt:>5}개")
    print("  " + "-" * 45)
    print(f"    {'총 관계 수':20s}: {total_rels:>5}개")


if __name__ == "__main__":
    asyncio.run(build_graph())
