"""
Neo4j 그래프 검증 스크립트 — 핵심 쿼리 실행 및 결과 출력
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import app.models.master       # noqa: F401
import app.models.snapshot     # noqa: F401
import app.models.event        # noqa: F401
import app.models.variance     # noqa: F401

import app.db.database as database
from app.db.neo4j_db import init_neo4j, close_neo4j, run_query


async def verify():
    await database.init_db()
    await init_neo4j()

    print()
    print("=" * 70)
    print("  Neo4j 그래프 검증")
    print("=" * 70)

    # ── 1. 상설 그래프: HBM_001의 전체 원가 구조 ──
    print("\n[검증 1] HBM_001 원가 구조 탐색")
    print("-" * 50)
    rows = await run_query("""
        MATCH (pg:ProductGroup)-[:CONTAINS]->(p:Product {prod_cd: 'HBM_001'})
              -[:COST_AT]->(proc:Process)
        OPTIONAL MATCH (proc)-[:HAS_SUBPROCESS]->(pgrp:ProcessGroup)
        OPTIONAL MATCH (proc)-[:COST_COMPOSED_OF]->(ce:CostElement)
        RETURN pg.grp_cd AS grp, p.prod_cd AS prod, p.prod_nm AS name,
               proc.proc_cd AS proc, proc.proc_nm AS proc_nm,
               pgrp.pgrp_cd AS pgrp, ce.ce_cd AS ce
        ORDER BY proc.proc_cd, ce.ce_cd
    """)
    for r in rows:
        print(f"  [{r['grp']}] {r['prod']} ({r['name']}) → "
              f"{r['proc']} ({r['proc_nm']}) → "
              f"공정군:{r['pgrp']} / 원가요소:{r['ce']}")

    # ── 2. ProcessGroup → Equipment 연결 확인 ──
    print("\n[검증 2] ProcessGroup → Equipment 연결")
    print("-" * 50)
    rows = await run_query("""
        MATCH (pg:ProcessGroup)-[:HAS_EQUIPMENT]->(eq:Equipment)
        RETURN pg.pgrp_cd AS pgrp, pg.pgrp_nm AS pgrp_nm,
               eq.equip_cd AS equip, eq.equip_nm AS equip_nm
        ORDER BY pg.pgrp_cd
    """)
    for r in rows:
        print(f"  {r['pgrp']} ({r['pgrp_nm']}) → {r['equip']} ({r['equip_nm']})")

    # ── 3. BOM 관계 확인 ──
    print("\n[검증 3] HBM_001 BOM (USES_MATERIAL)")
    print("-" * 50)
    rows = await run_query("""
        MATCH (p:Product {prod_cd: 'HBM_001'})-[r:USES_MATERIAL]->(m:Material)
        RETURN m.mat_cd AS mat, m.mat_nm AS name,
               r.std_qty AS qty, r.unit_price AS price
        ORDER BY m.mat_cd
    """)
    for r in rows:
        print(f"  {r['mat']} ({r['name']}): 수량={r['qty']}, 단가={r['price']}")

    # ── 4. 시나리오 1: FE_01 배부율 차이 인과 경로 ──
    print("\n[검증 4] 시나리오 1 — HBM_001 FE_01 배부율 차이 인과 경로")
    print("-" * 50)
    rows = await run_query("""
        MATCH (rv:Variance {product_cd: 'HBM_001', proc_cd: 'FE_01',
                            ce_cd: 'CE_DEP', var_type: 'RATE_VAR', yyyymm: '202501'})
        OPTIONAL MATCH (rv)-[c1:CAUSED_BY]->(sub:Variance)
        OPTIONAL MATCH (sub)-[e1:EVIDENCED_BY]->(evt:Event)
        RETURN rv.var_id AS rv_id, rv.var_amt AS rv_amt, rv.var_rate AS rv_rate,
               sub.var_id AS sub_id, sub.var_type AS sub_type, sub.var_amt AS sub_amt,
               c1.contribution AS contrib,
               evt.event_id AS evt_id, evt.source AS evt_src
        ORDER BY sub.var_type
    """)
    for r in rows:
        print(f"  {r['rv_id']} (배부율차이={r['rv_amt']}억, {r['rv_rate']:.1%})")
        if r.get('sub_id'):
            print(f"    └─CAUSED_BY({r['contrib']:.2f})→ {r['sub_id']} ({r['sub_type']}={r['sub_amt']}억)")
        if r.get('evt_id'):
            print(f"       └─EVIDENCED_BY→ {r['evt_id']} ({r['evt_src']})")

    # ── 5. 시나리오 2: 재료비 단가 차이 → 구매 이벤트 매칭 ──
    print("\n[검증 5] 시나리오 2 — HBM_001 재료비 단가 차이 → 구매 이벤트")
    print("-" * 50)
    rows = await run_query("""
        MATCH (pv:Variance {product_cd: 'HBM_001', var_type: 'PRICE_VAR', yyyymm: '202501'})
              -[eb:EVIDENCED_BY]->(evt:Event)
        RETURN pv.var_id AS pv_id, pv.var_amt AS pv_amt,
               evt.event_id AS evt_id, evt.source AS src,
               evt.target_cd AS target, evt.description AS desc,
               eb.match_score AS score
        ORDER BY evt.event_id
    """)
    for r in rows:
        print(f"  {r['pv_id']} (단가차이={r['pv_amt']}억)")
        print(f"    └─EVIDENCED_BY(score={r['score']})→ {r['evt_id']} ({r['src']})")
        print(f"       자재: {r['target']}, {r['desc']}")

    # ── 6. 시나리오 2: 사용량 차이 → PLM 이벤트 매칭 ──
    print("\n[검증 6] 시나리오 2 — HBM_001 사용량 차이 → PLM 이벤트")
    print("-" * 50)
    rows = await run_query("""
        MATCH (uv:Variance {product_cd: 'HBM_001', var_type: 'USAGE_VAR', yyyymm: '202501'})
              -[eb:EVIDENCED_BY]->(evt:Event)
        RETURN uv.var_id AS uv_id, uv.var_amt AS uv_amt,
               evt.event_id AS evt_id, evt.source AS src,
               evt.description AS desc
    """)
    for r in rows:
        print(f"  {r['uv_id']} (사용량차이={r['uv_amt']}억)")
        print(f"    └─EVIDENCED_BY→ {r['evt_id']} ({r['src']}): {r['desc']}")

    # ── 7. 파급 관계 (SPREADS_TO) ──
    print("\n[검증 7] 시나리오 3 — FE_01 CE_DEP 배부율 차이 파급 경로")
    print("-" * 50)
    rows = await run_query("""
        MATCH (v1:Variance {var_type: 'RATE_VAR', proc_cd: 'FE_01', ce_cd: 'CE_DEP',
                            yyyymm: '202501', product_cd: 'HBM_001'})
              -[:SPREADS_TO]->(v2:Variance)
        RETURN v2.product_cd AS prod, v2.var_amt AS amt, v2.var_rate AS rate
        ORDER BY abs(v2.var_amt) DESC
    """)
    print(f"  HBM_001 FE_01 CE_DEP 배부율 차이 → 파급 대상:")
    for r in rows:
        print(f"    → {r['prod']}: {r['amt']}억 ({r['rate']:.1%})")

    # ── 8. CONSUMES_GAS 관계 ──
    print("\n[검증 8] 공정군 → 기료 (CONSUMES_GAS)")
    print("-" * 50)
    rows = await run_query("""
        MATCH (pg:ProcessGroup)-[:CONSUMES_GAS]->(m:Material)
        RETURN pg.pgrp_cd AS pgrp, m.mat_cd AS mat, m.mat_nm AS name
    """)
    for r in rows:
        print(f"  {r['pgrp']} → {r['mat']} ({r['name']})")

    # ── 9. 전체 경로 탐색 예시 (LLM용 증거 패키지) ──
    print("\n[검증 9] HBM_001 전체 인과 경로 (깊이 3)")
    print("-" * 50)
    rows = await run_query("""
        MATCH path = (start:Variance {product_cd: 'HBM_001', proc_cd: 'FE_01',
                                      ce_cd: 'CE_DEP', var_type: 'RATE_VAR',
                                      yyyymm: '202501'})
                     -[:CAUSED_BY|EVIDENCED_BY*1..3]->(end)
        RETURN length(path) AS depth,
               [n IN nodes(path) | CASE
                   WHEN n:Variance THEN n.var_id + '(' + n.var_type + ')'
                   WHEN n:Event THEN n.event_id + '(' + n.source + ')'
                   ELSE '' END] AS node_path
        ORDER BY depth
        LIMIT 10
    """)
    for r in rows:
        print(f"  깊이 {r['depth']}: {' → '.join(r['node_path'])}")

    print()
    print("=" * 70)
    print("  검증 완료!")
    print("=" * 70)

    await close_neo4j()


if __name__ == "__main__":
    asyncio.run(verify())
