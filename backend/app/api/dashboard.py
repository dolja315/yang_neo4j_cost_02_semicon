"""
대시보드 API
- Level 0: 총괄 요약
- Level 1: 계정별 증감
- Level 2: 제품군별 증감
- Level 3: 제품코드별 원가요소 분해
- Level 4: 배부기준 분석
- Level 5: 소스시스템 연계

부서별 뷰: 경영진 / 원가팀 / 생산팀 / 구매팀
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.database import get_db_session
from app.db.neo4j_db import run_query

router = APIRouter()


@router.get("/summary")
async def get_summary(
    yyyymm: str = Query(..., description="기준월 (YYYYMM)"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Level 0: 총괄 요약
    "이번 달 총원가 전월 대비 +3.2% 증가"
    """
    prev_month = _get_prev_month(yyyymm)

    result = await session.execute(
        text("""
            SELECT
                SUM(CASE WHEN yyyymm = :curr THEN cost_amt ELSE 0 END) AS curr_total,
                SUM(CASE WHEN yyyymm = :prev THEN cost_amt ELSE 0 END) AS prev_total
            FROM snp_cost_result
            WHERE yyyymm IN (:curr, :prev)
        """),
        {"curr": yyyymm, "prev": prev_month},
    )
    row = result.fetchone()

    curr_total = row[0] or 0
    prev_total = row[1] or 0
    diff = curr_total - prev_total
    rate = (diff / prev_total * 100) if prev_total != 0 else 0

    return {
        "yyyymm": yyyymm,
        "prev_month": prev_month,
        "curr_total": round(curr_total, 2),
        "prev_total": round(prev_total, 2),
        "diff": round(diff, 2),
        "rate": round(rate, 2),
    }


@router.get("/by-cost-element")
async def get_by_cost_element(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Level 1: 계정별(원가요소별) 증감
    "어떤 비용이 올랐나?"
    """
    prev_month = _get_prev_month(yyyymm)

    result = await session.execute(
        text("""
            SELECT
                ce.ce_cd, ce.ce_nm, ce.ce_grp,
                SUM(CASE WHEN s.yyyymm = :curr THEN s.cost_amt ELSE 0 END) AS curr_amt,
                SUM(CASE WHEN s.yyyymm = :prev THEN s.cost_amt ELSE 0 END) AS prev_amt
            FROM snp_cost_result s
            JOIN mst_cost_element ce ON s.ce_cd = ce.ce_cd
            WHERE s.yyyymm IN (:curr, :prev)
            GROUP BY ce.ce_cd, ce.ce_nm, ce.ce_grp
            ORDER BY (SUM(CASE WHEN s.yyyymm = :curr THEN s.cost_amt ELSE 0 END)
                     - SUM(CASE WHEN s.yyyymm = :prev THEN s.cost_amt ELSE 0 END)) DESC
        """),
        {"curr": yyyymm, "prev": prev_month},
    )
    items = []
    for row in result.fetchall():
        curr = row[3] or 0
        prev = row[4] or 0
        diff = curr - prev
        rate = (diff / prev * 100) if prev != 0 else 0
        items.append({
            "ce_cd": row[0], "ce_nm": row[1], "ce_grp": row[2],
            "curr_amt": round(curr, 2), "prev_amt": round(prev, 2),
            "diff": round(diff, 2), "rate": round(rate, 2),
        })
    return {"yyyymm": yyyymm, "items": items}


@router.get("/by-product-group")
async def get_by_product_group(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Level 2: 제품군별 증감
    "어떤 제품군이 문제인가?"
    """
    prev_month = _get_prev_month(yyyymm)

    result = await session.execute(
        text("""
            SELECT
                p.product_grp,
                SUM(CASE WHEN s.yyyymm = :curr THEN s.cost_amt ELSE 0 END) AS curr_amt,
                SUM(CASE WHEN s.yyyymm = :prev THEN s.cost_amt ELSE 0 END) AS prev_amt
            FROM snp_cost_result s
            JOIN mst_product p ON s.product_cd = p.product_cd
            WHERE s.yyyymm IN (:curr, :prev)
            GROUP BY p.product_grp
            ORDER BY (SUM(CASE WHEN s.yyyymm = :curr THEN s.cost_amt ELSE 0 END)
                     - SUM(CASE WHEN s.yyyymm = :prev THEN s.cost_amt ELSE 0 END)) DESC
        """),
        {"curr": yyyymm, "prev": prev_month},
    )
    items = []
    for row in result.fetchall():
        curr = row[1] or 0
        prev = row[2] or 0
        diff = curr - prev
        rate = (diff / prev * 100) if prev != 0 else 0
        items.append({
            "product_grp": row[0],
            "curr_amt": round(curr, 2), "prev_amt": round(prev, 2),
            "diff": round(diff, 2), "rate": round(rate, 2),
        })
    return {"yyyymm": yyyymm, "items": items}


@router.get("/by-product")
async def get_by_product(
    yyyymm: str = Query(..., description="기준월"),
    product_grp: str = Query(None, description="제품군 필터"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Level 3: 제품코드별 원가요소 분해
    "왜 올랐나? 비용인가, 물량인가?"
    """
    result = await session.execute(
        text("""
            SELECT
                v.product_cd, v.proc_cd, v.ce_cd, v.var_type,
                v.var_amt, v.var_rate, v.prev_amt, v.curr_amt
            FROM cal_variance v
            WHERE v.yyyymm = :ym
              AND (:grp IS NULL OR v.product_grp = :grp)
              AND v.product_cd IS NOT NULL
            ORDER BY ABS(v.var_amt) DESC
        """),
        {"ym": yyyymm, "grp": product_grp},
    )
    items = [dict(zip(result.keys(), row)) for row in result.fetchall()]
    return {"yyyymm": yyyymm, "product_grp": product_grp, "items": items}


@router.get("/alloc-analysis")
async def get_alloc_analysis(
    yyyymm: str = Query(..., description="기준월"),
    product_cd: str = Query(..., description="제품코드"),
    proc_cd: str = Query(..., description="공정코드"),
    ce_cd: str = Query(..., description="원가요소코드"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Level 4: 배부기준 분석
    "비용이 늘었나, 분모가 줄었나?"
    """
    result = await session.execute(
        text("""
            SELECT var_type, var_amt, var_rate
            FROM cal_variance
            WHERE yyyymm = :ym AND product_cd = :prod
              AND proc_cd = :proc AND ce_cd = :ce
        """),
        {"ym": yyyymm, "prod": product_cd, "proc": proc_cd, "ce": ce_cd},
    )
    items = [dict(zip(result.keys(), row)) for row in result.fetchall()]
    return {
        "yyyymm": yyyymm,
        "product_cd": product_cd,
        "proc_cd": proc_cd,
        "ce_cd": ce_cd,
        "decomposition": items,
    }


@router.get("/source-events")
async def get_source_events(
    yyyymm: str = Query(..., description="기준월"),
    var_id: str = Query(None, description="차이 ID"),
):
    """
    Level 5: 소스시스템 연계
    "실물에서 무슨 일이 있었나?"
    """
    if var_id:
        # 특정 차이 노드와 연결된 이벤트
        records = await run_query("""
            MATCH (v:Variance {var_id: $var_id})
            OPTIONAL MATCH (v)-[:CAUSED_BY*0..3]->(leaf)-[:EVIDENCED_BY]->(evt:Event)
            RETURN DISTINCT evt {.*} AS event
        """, {"var_id": var_id})
        events = [r["event"] for r in records if r["event"]]
    else:
        # 해당 월 전체 이벤트
        records = await run_query("""
            MATCH (e:Event {yyyymm: $yyyymm})
            RETURN e {.*} AS event
            ORDER BY e.source
        """, {"yyyymm": yyyymm})
        events = [r["event"] for r in records]

    return {"yyyymm": yyyymm, "events": events}


@router.get("/view/executive")
async def executive_view(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """경영진 뷰 - 제품군별 원가 증감 + 핵심 원인 요약"""
    summary = await get_summary(yyyymm=yyyymm, session=session)
    by_group = await get_by_product_group(yyyymm=yyyymm, session=session)

    # Neo4j에서 LLM 해석 가져오기
    records = await run_query("""
        MATCH (v:Variance {yyyymm: $yyyymm})
        WHERE v.llm_alert_level IN ['경고', '긴급']
        RETURN v.product_grp AS grp, v.llm_summary AS summary,
               v.llm_alert_level AS alert_level
        ORDER BY CASE v.llm_alert_level
            WHEN '긴급' THEN 1 WHEN '경고' THEN 2 ELSE 3 END
        LIMIT 5
    """, {"yyyymm": yyyymm})

    return {
        "summary": summary,
        "by_product_group": by_group,
        "alerts": records,
    }


@router.get("/top-variances")
async def get_top_variances(
    yyyymm: str = Query(..., description="기준월"),
    limit: int = Query(20, description="상위 N건"),
    session: AsyncSession = Depends(get_db_session),
):
    """주요 차이 항목 — 금액 기준 상위 N건 + 인과 요약"""
    result = await session.execute(
        text("""
            SELECT v.var_id, v.product_grp, v.product_cd, v.proc_cd, v.ce_cd,
                   v.var_type, v.var_amt, v.var_rate, v.prev_amt, v.curr_amt
            FROM cal_variance v
            WHERE v.yyyymm = :ym AND v.product_cd IS NOT NULL
            ORDER BY ABS(v.var_amt) DESC
            LIMIT :lim
        """),
        {"ym": yyyymm, "lim": limit},
    )
    items = [dict(zip(result.keys(), row)) for row in result.fetchall()]
    return {"yyyymm": yyyymm, "items": items}


@router.get("/causal-analysis")
async def get_causal_analysis(
    yyyymm: str = Query(..., description="기준월"),
    product_cd: str = Query(..., description="제품코드"),
):
    """특정 제품의 인과 경로 분석 — Neo4j 그래프 탐색"""
    # 해당 제품의 차이 노드 요약
    variances = await run_query("""
        MATCH (v:Variance {yyyymm: $yyyymm, product_cd: $product_cd})
        RETURN v.var_id AS var_id, v.var_type AS var_type,
               v.proc_cd AS proc_cd, v.ce_cd AS ce_cd,
               v.var_amt AS var_amt, v.var_rate AS var_rate
        ORDER BY abs(v.var_amt) DESC
    """, {"yyyymm": yyyymm, "product_cd": product_cd})

    # 인과 경로 (CAUSED_BY)
    caused_by = await run_query("""
        MATCH (parent:Variance {yyyymm: $yyyymm, product_cd: $product_cd})
              -[r:CAUSED_BY]->(child:Variance)
        RETURN parent.var_id AS parent_id, parent.var_type AS parent_type,
               child.var_id AS child_id, child.var_type AS child_type,
               child.var_amt AS child_amt,
               r.contribution AS contribution
        ORDER BY abs(child.var_amt) DESC
    """, {"yyyymm": yyyymm, "product_cd": product_cd})

    # 근거 이벤트 (EVIDENCED_BY)
    evidences = await run_query("""
        MATCH (v:Variance {yyyymm: $yyyymm, product_cd: $product_cd})
              -[:CAUSED_BY*0..3]->(leaf:Variance)
              -[eb:EVIDENCED_BY]->(evt:Event)
        RETURN DISTINCT leaf.var_id AS var_id, leaf.var_type AS var_type,
               evt.event_id AS event_id, evt.source AS source,
               evt.event_type AS event_type, evt.target_cd AS target_cd,
               evt.description AS description,
               evt.prev_value AS prev_value, evt.curr_value AS curr_value,
               evt.chg_rate AS chg_rate,
               eb.match_score AS match_score
        ORDER BY eb.match_score DESC
    """, {"yyyymm": yyyymm, "product_cd": product_cd})

    # 파급 관계 (SPREADS_TO)
    spreads = await run_query("""
        MATCH (v1:Variance {yyyymm: $yyyymm, product_cd: $product_cd,
                            var_type: 'RATE_VAR'})
              -[:SPREADS_TO]->(v2:Variance)
        RETURN DISTINCT v1.proc_cd AS proc_cd, v1.ce_cd AS ce_cd,
               v2.product_cd AS affected_product,
               v2.var_amt AS affected_amt, v2.var_rate AS affected_rate
        ORDER BY abs(v2.var_amt) DESC
    """, {"yyyymm": yyyymm, "product_cd": product_cd})

    return {
        "yyyymm": yyyymm,
        "product_cd": product_cd,
        "variances": variances,
        "caused_by": caused_by,
        "evidences": evidences,
        "spreads": spreads,
    }


@router.get("/graph-data")
async def get_graph_data(
    yyyymm: str = Query(..., description="기준월"),
    product_cd: str = Query(..., description="제품코드"),
):
    """
    인과 그래프 시각화 데이터 — 노드/링크 형식
    노드를 확장하며 원인 추적할 수 있도록 계층적 level 부여

    Level 0: 제품 원가 차이 (root)
    Level 1: 원가요소별 차이 (감가상각비, 인건비, 전력비, 재료비)
    Level 2: 하위 분해 (단위원가 변동, 생산Mix 변동 / 자재단가, BOM사용량)
    Level 3: 상세 원인 (총액 증감, 가동시간 변동 / 공정별 내역)
    Level 4: 근거 이벤트 (MES, PLM, 구매)
    Level 5: 파급 제품 (SPREADS_TO)
    """
    # ── 1) Neo4j 조회 ──
    variances = await run_query("""
        MATCH (v:Variance {yyyymm: $yyyymm, product_cd: $product_cd})
        RETURN v.var_id AS var_id, v.var_type AS var_type,
               v.proc_cd AS proc_cd, v.ce_cd AS ce_cd,
               v.var_amt AS var_amt
    """, {"yyyymm": yyyymm, "product_cd": product_cd})

    evidences = await run_query("""
        MATCH (v:Variance {yyyymm: $yyyymm, product_cd: $product_cd})
              -[:CAUSED_BY*0..3]->(leaf:Variance)
              -[:EVIDENCED_BY]->(evt:Event)
        RETURN DISTINCT leaf.var_id AS var_id, leaf.var_type AS var_type,
               leaf.ce_cd AS ce_cd,
               evt.event_id AS event_id, evt.source AS source,
               evt.description AS description,
               evt.prev_value AS prev_value, evt.curr_value AS curr_value,
               evt.chg_rate AS chg_rate
    """, {"yyyymm": yyyymm, "product_cd": product_cd})

    spreads = await run_query("""
        MATCH (v:Variance {yyyymm: $yyyymm, product_cd: $product_cd,
                           var_type: 'RATE_VAR'})
              -[:SPREADS_TO]->(v2:Variance)
        WITH v2.product_cd AS product_cd, sum(v2.var_amt) AS total
        RETURN product_cd, round(total * 100) / 100 AS var_amt
        ORDER BY abs(total) DESC
        LIMIT 5
    """, {"yyyymm": yyyymm, "product_cd": product_cd})

    # ── 2) 메타데이터 ──
    CE_META = {
        "CE_DEP": ("감가상각비", "가동시간"),
        "CE_LAB": ("인건비",     "가동시간"),
        "CE_PWR": ("전력비",     "가동시간"),
        "CE_MAT": ("재료비",     "BOM"),
        "CE_MNT": ("수선유지비", "가동시간"),
        "CE_GAS": ("기료비",     "가동시간"),
        "CE_OTH": ("기타경비",   "가동시간"),
    }
    PROC_NM = {
        "FE_01": "전공정_식각", "FE_02": "전공정_증착", "FE_03": "전공정_포토",
        "FE_04": "전공정_확산", "FE_05": "전공정_CMP",
        "BE_01": "후공정_조립", "BE_02": "후공정_가공", "BE_03": "후공정_테스트",
    }

    # ── 3) 원가요소별 그룹핑 ──
    ce_data: dict = {}
    for v in variances:
        ce = v["ce_cd"]
        if ce not in ce_data:
            ce_data[ce] = []
        ce_data[ce].append(v)

    nodes: list = []
    links: list = []
    ev_added: set = set()

    def _r(x):
        return round(x, 2) if x else 0

    def add_evidence_nodes(parent_id: str, var_type_filter: str, ce_filter: str):
        """근거 이벤트 노드 추가"""
        for ev in evidences:
            if ev["var_type"] != var_type_filter or ev["ce_cd"] != ce_filter:
                continue
            eid = f"EVT_{ev['event_id']}"
            if eid not in ev_added:
                detail = ""
                if ev.get("prev_value") is not None:
                    pct = f" ({ev['chg_rate']*100:+.1f}%)" if ev.get("chg_rate") else ""
                    detail = f"{ev['prev_value']}→{ev['curr_value']}{pct}"
                nodes.append({
                    "id": eid,
                    "label": ev.get("description") or f"{ev['source']} {ev['event_id']}",
                    "sublabel": detail,
                    "type": "event",
                    "source_type": ev["source"],
                    "val": 0, "level": 4,
                })
                ev_added.add(eid)
            links.append({"source": parent_id, "target": eid, "label": "근거"})

    # ── 4) 그래프 구축 ──
    # Level 0: Product root
    total_var = 0
    for ce_vars in ce_data.values():
        for v in ce_vars:
            if v["var_type"] in ("RATE_VAR", "QTY_VAR", "PRICE_VAR", "USAGE_VAR"):
                total_var += v["var_amt"]

    root_id = f"PRD_{product_cd}"
    nodes.append({
        "id": root_id, "label": product_cd,
        "sublabel": "원가 차이 합계",
        "type": "product", "val": _r(total_var), "level": 0,
    })

    ce_order = ["CE_DEP", "CE_LAB", "CE_PWR", "CE_MAT", "CE_MNT", "CE_GAS", "CE_OTH"]
    for ce in ce_order:
        if ce not in ce_data:
            continue
        vars_list = ce_data[ce]
        ce_name, basis = CE_META.get(ce, (ce, ""))

        # CE 합계 (RATE_VAR+QTY_VAR or PRICE_VAR+USAGE_VAR)
        ce_total = sum(
            v["var_amt"] for v in vars_list
            if v["var_type"] in ("RATE_VAR", "QTY_VAR", "PRICE_VAR", "USAGE_VAR")
        )

        # Level 1: 원가요소
        ce_id = f"CE_{ce}"
        nodes.append({
            "id": ce_id, "label": f"{ce_name} 차이",
            "sublabel": f"배부기준: {basis}",
            "type": "cost_element", "val": _r(ce_total), "level": 1,
        })
        links.append({"source": root_id, "target": ce_id, "label": "비용분해"})

        if ce == "CE_MAT":
            # ── 재료비: 단가/사용량 ──
            pv = [v for v in vars_list if v["var_type"] == "PRICE_VAR"]
            uv = [v for v in vars_list if v["var_type"] == "USAGE_VAR"]

            pv_id = f"SUB_{ce}_PV"
            pv_total = sum(v["var_amt"] for v in pv)
            nodes.append({
                "id": pv_id, "label": "자재 단가 변동",
                "sublabel": "구매 단가 변경에 의한 원가 변동",
                "type": "sub_var", "val": _r(pv_total), "level": 2,
            })
            links.append({"source": ce_id, "target": pv_id, "label": "분해"})
            add_evidence_nodes(pv_id, "PRICE_VAR", ce)

            uv_id = f"SUB_{ce}_UV"
            uv_total = sum(v["var_amt"] for v in uv)
            nodes.append({
                "id": uv_id, "label": "BOM 사용량 변동",
                "sublabel": "설계 변경(PLM)에 의한 사용량 변동",
                "type": "sub_var", "val": _r(uv_total), "level": 2,
            })
            links.append({"source": ce_id, "target": uv_id, "label": "분해"})
            add_evidence_nodes(uv_id, "USAGE_VAR", ce)

        else:
            # ── 배부원가: 단위원가 + 생산Mix ──
            rv = [v for v in vars_list if v["var_type"] == "RATE_VAR"]
            qv = [v for v in vars_list if v["var_type"] == "QTY_VAR"]
            rc = [v for v in vars_list if v["var_type"] == "RATE_COST"]
            rb = [v for v in vars_list if v["var_type"] == "RATE_BASE"]

            rv_total = sum(v["var_amt"] for v in rv)
            qv_total = sum(v["var_amt"] for v in qv)
            rc_total = sum(v["var_amt"] for v in rc)
            rb_total = sum(v["var_amt"] for v in rb)

            # Level 2: 단위원가 변동
            rv_id = f"SUB_{ce}_RV"
            nodes.append({
                "id": rv_id, "label": "단위원가 변동",
                "sublabel": "비용총액 및 배부기준 효과",
                "type": "sub_var", "val": _r(rv_total), "level": 2,
            })
            links.append({"source": ce_id, "target": rv_id, "label": "분해"})

            # Level 3: 총액 증감
            rc_id = f"DET_{ce}_RC"
            nodes.append({
                "id": rc_id, "label": f"{ce_name} 총액 증감",
                "sublabel": f"{ce_name} 자체의 증감",
                "type": "detail", "val": _r(rc_total), "level": 3,
            })
            links.append({"source": rv_id, "target": rc_id, "label": "원인"})

            # Level 3: 가동시간 변동
            rb_id = f"DET_{ce}_RB"
            nodes.append({
                "id": rb_id, "label": f"{basis} 변동",
                "sublabel": "가동률·수율 하락 → 단위원가 상승",
                "type": "detail", "val": _r(rb_total), "level": 3,
            })
            links.append({"source": rv_id, "target": rb_id, "label": "원인"})
            add_evidence_nodes(rb_id, "RATE_BASE", ce)

            # Level 2: 생산Mix 변동
            qv_id = f"SUB_{ce}_QV"
            nodes.append({
                "id": qv_id, "label": "생산Mix 변동",
                "sublabel": "제품별 배분 비중 변화",
                "type": "sub_var", "val": _r(qv_total), "level": 2,
            })
            links.append({"source": ce_id, "target": qv_id, "label": "분해"})

    # ── Level 5: 파급 제품 ──
    for sp in spreads:
        sp_id = f"SPR_{sp['product_cd']}"
        nodes.append({
            "id": sp_id, "label": sp["product_cd"],
            "sublabel": "파급 영향 제품",
            "type": "spread", "val": _r(sp["var_amt"]), "level": 5,
        })
        links.append({"source": root_id, "target": sp_id, "label": "파급(SPREADS_TO)"})

    return {"nodes": nodes, "links": links}


@router.get("/graph-stats")
async def get_graph_stats():
    """Neo4j 그래프 통계"""
    node_labels = [
        "ProductGroup", "Product", "Process", "ProcessGroup",
        "Equipment", "Material", "CostElement", "AllocBase",
        "Variance", "Event",
    ]
    nodes = {}
    for label in node_labels:
        rows = await run_query(f"MATCH (n:{label}) RETURN count(n) AS cnt")
        nodes[label] = rows[0]["cnt"] if rows else 0

    rel_types = [
        "CONTAINS", "COST_AT", "HAS_SUBPROCESS", "HAS_EQUIPMENT",
        "COST_COMPOSED_OF", "ALLOCATED_BY", "USES_MATERIAL", "CONSUMES_GAS",
        "OCCURS_AT", "OCCURS_IN", "RELATES_TO", "INVOLVES",
        "CAUSED_BY", "EVIDENCED_BY", "SPREADS_TO", "SIMILAR_TO",
    ]
    rels = {}
    for rtype in rel_types:
        rows = await run_query(f"MATCH ()-[r:{rtype}]->() RETURN count(r) AS cnt")
        rels[rtype] = rows[0]["cnt"] if rows else 0

    return {
        "nodes": nodes,
        "relationships": rels,
        "total_nodes": sum(nodes.values()),
        "total_relationships": sum(rels.values()),
    }


def _get_prev_month(yyyymm: str) -> str:
    """전월 계산"""
    year = int(yyyymm[:4])
    month = int(yyyymm[4:6])
    if month == 1:
        return f"{year - 1}12"
    return f"{year}{month - 1:02d}"


def _get_months_range(yyyymm: str, count: int = 6) -> list:
    """최종월로부터 N개월 역산 리스트"""
    y, m = int(yyyymm[:4]), int(yyyymm[4:6])
    months = []
    for i in range(count - 1, -1, -1):
        nm = m - i
        ny = y
        while nm <= 0:
            nm += 12
            ny -= 1
        months.append(f"{ny}{nm:02d}")
    return months


# ═══════════════════════════════════════════════════════════════
# 신규 API — 대시보드 뷰 전용
# ═══════════════════════════════════════════════════════════════


@router.get("/trend-by-product-group")
async def get_trend_by_product_group(
    yyyymm: str = Query(..., description="기준월 (최종월)"),
    months: int = Query(6, description="조회 개월수"),
    session: AsyncSession = Depends(get_db_session),
):
    """6개월 제품군별 원가 추이 — 라인차트용 (피벗 형태)"""
    all_months = _get_months_range(yyyymm, months)
    ph = ", ".join([f":m{i}" for i in range(len(all_months))])
    params = {f"m{i}": v for i, v in enumerate(all_months)}

    result = await session.execute(
        text(f"""
            SELECT p.product_grp, s.yyyymm,
                   ROUND(CAST(SUM(s.cost_amt) AS numeric), 1) AS total_amt
            FROM snp_cost_result s
            JOIN mst_product p ON s.product_cd = p.product_cd
            WHERE s.yyyymm IN ({ph})
            GROUP BY p.product_grp, s.yyyymm
            ORDER BY s.yyyymm, p.product_grp
        """),
        params,
    )

    raw: dict = {}
    groups: set = set()
    for row in result.fetchall():
        grp, ym, amt = row[0], row[1], float(row[2] or 0)
        groups.add(grp)
        raw.setdefault(ym, {})[grp] = amt

    sorted_groups = sorted(groups)
    trend = []
    for ym in all_months:
        entry: dict = {"month": f"{int(ym[4:6]):02d}월"}
        for grp in sorted_groups:
            entry[grp] = raw.get(ym, {}).get(grp, 0)
        trend.append(entry)

    return {"groups": sorted_groups, "trend": trend}


@router.get("/cost-element-drilldown")
async def get_cost_element_drilldown(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """원가요소별 상세 드릴다운 — 6개월 추이 + 공정별 하위 계정"""
    all_months = _get_months_range(yyyymm, 6)
    prev_month = _get_prev_month(yyyymm)
    ph = ", ".join([f":m{i}" for i in range(len(all_months))])
    params = {f"m{i}": v for i, v in enumerate(all_months)}

    # 1) 6개월 원가요소별 합계
    trend_result = await session.execute(
        text(f"""
            SELECT ce.ce_cd, ce.ce_nm, s.yyyymm,
                   ROUND(CAST(SUM(s.cost_amt) AS numeric), 1) AS total_amt
            FROM snp_cost_result s
            JOIN mst_cost_element ce ON s.ce_cd = ce.ce_cd
            WHERE s.yyyymm IN ({ph})
            GROUP BY ce.ce_cd, ce.ce_nm, s.yyyymm
            ORDER BY ce.ce_cd, s.yyyymm
        """),
        params,
    )
    trend_map: dict = {}
    ce_names: dict = {}
    for row in trend_result.fetchall():
        ce_cd, ce_nm, ym, amt = row[0], row[1], row[2], float(row[3] or 0)
        trend_map.setdefault(ce_cd, {})[ym] = amt
        ce_names[ce_cd] = ce_nm

    # 2) 공정별 세분화 (당월/전월)
    proc_result = await session.execute(
        text("""
            SELECT ce.ce_cd, p.proc_cd, p.proc_nm, p.proc_type,
                   ROUND(CAST(SUM(CASE WHEN s.yyyymm = :curr THEN s.cost_amt ELSE 0 END) AS numeric), 1) AS curr_amt,
                   ROUND(CAST(SUM(CASE WHEN s.yyyymm = :prev THEN s.cost_amt ELSE 0 END) AS numeric), 1) AS prev_amt
            FROM snp_cost_result s
            JOIN mst_cost_element ce ON s.ce_cd = ce.ce_cd
            JOIN mst_process p ON s.proc_cd = p.proc_cd
            WHERE s.yyyymm IN (:curr, :prev)
            GROUP BY ce.ce_cd, p.proc_cd, p.proc_nm, p.proc_type
            ORDER BY ce.ce_cd, p.proc_type, p.proc_cd
        """),
        {"curr": yyyymm, "prev": prev_month},
    )
    proc_breakdown: dict = {}
    for row in proc_result.fetchall():
        ce_cd = row[0]
        proc_breakdown.setdefault(ce_cd, []).append({
            "proc_cd": row[1], "proc_nm": row[2], "proc_type": row[3],
            "curr_amt": float(row[4] or 0), "prev_amt": float(row[5] or 0),
        })

    # 3) 합산
    total_curr = sum(
        trend_map.get(ce, {}).get(yyyymm, 0) for ce in trend_map
    )

    items = []
    for ce_cd in sorted(trend_map.keys()):
        ce_nm = ce_names.get(ce_cd, ce_cd)
        trend = [trend_map[ce_cd].get(ym, 0) for ym in all_months]
        curr_amt = trend[-1] if trend else 0
        prev_amt = trend[-2] if len(trend) >= 2 else 0
        diff = round(curr_amt - prev_amt, 1)
        pct = round(curr_amt / total_curr * 100, 1) if total_curr else 0

        procs = proc_breakdown.get(ce_cd, [])
        fe_procs = [p for p in procs if p["proc_type"] == "FE"]
        be_procs = [p for p in procs if p["proc_type"] == "BE"]

        sub_accounts = []
        if fe_procs:
            fe_curr = sum(p["curr_amt"] for p in fe_procs)
            fe_prev = sum(p["prev_amt"] for p in fe_procs)
            sub_accounts.append({
                "name": f"전공정 {ce_nm}",
                "amount": round(fe_curr, 1),
                "change": round(fe_curr - fe_prev, 1),
                "details": [],
                "items": [{
                    "name": p["proc_nm"],
                    "amount": round(p["curr_amt"], 1),
                    "change": round(p["curr_amt"] - p["prev_amt"], 1),
                } for p in fe_procs],
            })
        if be_procs:
            be_curr = sum(p["curr_amt"] for p in be_procs)
            be_prev = sum(p["prev_amt"] for p in be_procs)
            sub_accounts.append({
                "name": f"후공정 {ce_nm}",
                "amount": round(be_curr, 1),
                "change": round(be_curr - be_prev, 1),
                "details": [],
                "items": [{
                    "name": p["proc_nm"],
                    "amount": round(p["curr_amt"], 1),
                    "change": round(p["curr_amt"] - p["prev_amt"], 1),
                } for p in be_procs],
            })

        items.append({
            "ce_cd": ce_cd,
            "category": ce_nm,
            "amount": round(curr_amt, 1),
            "change": diff,
            "percent": pct,
            "trend": [round(v, 1) for v in trend],
            "subAccounts": sub_accounts,
        })

    items.sort(key=lambda x: x["change"], reverse=True)
    return {"yyyymm": yyyymm, "items": items}


@router.get("/process-summary")
async def get_process_summary(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """공정별 원가 요약 — 파이프라인 뷰용"""
    prev_month = _get_prev_month(yyyymm)

    # 1) 공정별 합계
    result = await session.execute(
        text("""
            SELECT p.proc_cd, p.proc_nm, p.proc_type,
                   ROUND(CAST(SUM(CASE WHEN s.yyyymm = :curr THEN s.cost_amt ELSE 0 END) AS numeric), 1),
                   ROUND(CAST(SUM(CASE WHEN s.yyyymm = :prev THEN s.cost_amt ELSE 0 END) AS numeric), 1)
            FROM snp_cost_result s
            JOIN mst_process p ON s.proc_cd = p.proc_cd
            WHERE s.yyyymm IN (:curr, :prev)
            GROUP BY p.proc_cd, p.proc_nm, p.proc_type
            ORDER BY p.proc_type, p.proc_cd
        """),
        {"curr": yyyymm, "prev": prev_month},
    )

    proc_data: dict = {}
    for row in result.fetchall():
        curr = float(row[3] or 0)
        prev = float(row[4] or 0)
        diff = curr - prev
        rate = (diff / prev * 100) if prev else 0
        proc_data[row[0]] = {
            "proc_cd": row[0], "proc_nm": row[1], "proc_type": row[2],
            "curr_amt": round(curr, 1), "prev_amt": round(prev, 1),
            "diff": round(diff, 1), "rate": round(rate, 1),
            "costElements": [],
        }

    # 2) 공정 × 원가요소
    ce_result = await session.execute(
        text("""
            SELECT s.proc_cd, ce.ce_cd, ce.ce_nm,
                   ROUND(CAST(SUM(CASE WHEN s.yyyymm = :curr THEN s.cost_amt ELSE 0 END) AS numeric), 1),
                   ROUND(CAST(SUM(CASE WHEN s.yyyymm = :prev THEN s.cost_amt ELSE 0 END) AS numeric), 1)
            FROM snp_cost_result s
            JOIN mst_cost_element ce ON s.ce_cd = ce.ce_cd
            WHERE s.yyyymm IN (:curr, :prev)
            GROUP BY s.proc_cd, ce.ce_cd, ce.ce_nm
            ORDER BY s.proc_cd, ce.ce_cd
        """),
        {"curr": yyyymm, "prev": prev_month},
    )

    for row in ce_result.fetchall():
        proc_cd = row[0]
        curr = float(row[3] or 0)
        prev = float(row[4] or 0)
        if proc_cd in proc_data:
            proc_data[proc_cd]["costElements"].append({
                "ce_cd": row[1], "name": row[2],
                "amount": round(curr, 1), "prevAmount": round(prev, 1),
                "change": round((curr - prev) / prev * 100, 1) if prev else 0,
            })

    return {"yyyymm": yyyymm, "items": list(proc_data.values())}


@router.get("/alloc-summary")
async def get_alloc_summary(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """배부기준 분석 요약 — 배부율 변동 현황"""
    prev_month = _get_prev_month(yyyymm)

    result = await session.execute(
        text("""
            SELECT
                ar.proc_cd, p.proc_nm, ar.ce_cd, ce.ce_nm, ar.base_unit,
                ar.total_cost, ar.total_base, ar.alloc_rate,
                ar2.total_cost, ar2.total_base, ar2.alloc_rate
            FROM snp_alloc_rate ar
            JOIN mst_process p ON ar.proc_cd = p.proc_cd
            JOIN mst_cost_element ce ON ar.ce_cd = ce.ce_cd
            LEFT JOIN snp_alloc_rate ar2
                ON ar2.proc_cd = ar.proc_cd AND ar2.ce_cd = ar.ce_cd AND ar2.yyyymm = :prev
            WHERE ar.yyyymm = :curr
            ORDER BY ar.proc_cd, ar.ce_cd
        """),
        {"curr": yyyymm, "prev": prev_month},
    )

    items = []
    for row in result.fetchall():
        cc = float(row[5] or 0)
        cb = float(row[6] or 0)
        cr = float(row[7] or 0)
        pc = float(row[8] or 0)
        pb = float(row[9] or 0)
        pr = float(row[10] or 0)
        items.append({
            "proc_cd": row[0], "proc_nm": row[1],
            "ce_cd": row[2], "ce_nm": row[3], "unit": row[4],
            "current": {"total_cost": round(cc, 1), "total_base": round(cb, 1), "alloc_rate": round(cr, 2)},
            "previous": {"total_cost": round(pc, 1), "total_base": round(pb, 1), "alloc_rate": round(pr, 2)},
            "diff_cost": round(cc - pc, 1),
            "diff_base": round(cb - pb, 1),
            "diff_rate": round(cr - pr, 2),
        })

    return {"yyyymm": yyyymm, "items": items}
