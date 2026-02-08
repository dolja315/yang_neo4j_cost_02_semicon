"""
분석 API
- 차이 계산 실행
- 그래프 구축 실행
- 인과관계 탐색
- LLM 해석 실행
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_session
from app.db.neo4j_db import run_query
from app.services.variance_calc import VarianceCalculator
from app.services.graph_builder import GraphBuilder
from app.services.rule_engine import RuleEngine
from app.services.evidence import EvidenceBuilder
from app.services.llm_engine import LLMEngine

router = APIRouter()


@router.post("/calculate-variance")
async def calculate_variance(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """Step 3: 차이 계산 실행"""
    calculator = VarianceCalculator(session)
    results = await calculator.calculate_all(yyyymm)
    return {"yyyymm": yyyymm, "count": len(results), "message": "차이 계산 완료"}


@router.post("/build-graph")
async def build_graph(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """Step 4: 그래프 구축 실행"""
    builder = GraphBuilder(session)

    # 4a: 상설 그래프 갱신
    await builder.build_permanent_graph()
    # 4b: 차이 노드 생성
    await builder.create_variance_nodes(yyyymm)
    # 4c: 이벤트 노드 생성
    await builder.create_event_nodes(yyyymm)

    return {"yyyymm": yyyymm, "message": "그래프 구축 완료"}


@router.post("/run-rules")
async def run_rules(
    yyyymm: str = Query(..., description="기준월"),
):
    """Step 4d: 인과관계 규칙 엔진 실행"""
    engine = RuleEngine()
    await engine.execute_all_rules(yyyymm)
    return {"yyyymm": yyyymm, "message": "규칙 엔진 실행 완료"}


@router.post("/interpret")
async def interpret_variances(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """Step 5: LLM 해석 생성"""
    evidence_builder = EvidenceBuilder(session)
    llm_engine = LLMEngine(evidence_builder)
    results = await llm_engine.interpret_all_variances(yyyymm)
    return {"yyyymm": yyyymm, "count": len(results), "message": "LLM 해석 완료"}


@router.get("/causal-path")
async def get_causal_path(
    var_id: str = Query(None, description="차이 ID"),
    product_cd: str = Query(None, description="제품코드"),
    yyyymm: str = Query(None, description="기준월"),
):
    """인과 경로 전체 탐색"""
    if var_id:
        records = await run_query("""
            MATCH path = (start:Variance {var_id: $var_id})
                         -[:CAUSED_BY|EVIDENCED_BY*1..5]->(end)
            RETURN [n IN nodes(path) | n {.*}] AS nodes,
                   [r IN relationships(path) | type(r)] AS rels
            ORDER BY length(path)
        """, {"var_id": var_id})
    elif product_cd and yyyymm:
        records = await run_query("""
            MATCH (start:Variance {product_cd: $product_cd, yyyymm: $yyyymm})
            WHERE start.var_type IN ['RATE_VAR', 'QTY_VAR', 'PRICE_VAR', 'USAGE_VAR']
            OPTIONAL MATCH path = (start)-[:CAUSED_BY|EVIDENCED_BY*1..5]->(end)
            RETURN start {.*} AS start_node,
                   CASE WHEN path IS NOT NULL
                        THEN [n IN nodes(path) | n {.*}]
                        ELSE [] END AS nodes
            ORDER BY abs(start.var_amt) DESC
        """, {"product_cd": product_cd, "yyyymm": yyyymm})
    else:
        return {"error": "var_id 또는 product_cd + yyyymm을 지정하세요."}

    return {"paths": records}


@router.get("/spread-analysis")
async def get_spread_analysis(
    var_id: str = Query(..., description="차이 ID"),
):
    """파급 경로 탐색"""
    records = await run_query("""
        MATCH (start:Variance {var_id: $var_id})-[:SPREADS_TO]->(affected:Variance)
        RETURN affected {.*} AS affected_variance
        ORDER BY abs(affected.var_amt) DESC
    """, {"var_id": var_id})
    return {"source": var_id, "affected": [r["affected_variance"] for r in records]}


@router.get("/evidence-package")
async def get_evidence_package(
    var_id: str = Query(..., description="차이 ID"),
    session: AsyncSession = Depends(get_db_session),
):
    """특정 차이 노드의 전체 증거 패키지"""
    builder = EvidenceBuilder(session)
    evidence = await builder.build_evidence_package(var_id)
    return evidence
