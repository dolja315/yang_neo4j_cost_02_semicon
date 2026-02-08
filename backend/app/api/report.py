"""
보고서 API
- 경영진 요약 보고서
- 부서별 상세 보고서 (원가팀, 생산팀, 구매팀)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.database import get_db_session
from app.db.neo4j_db import run_query
from app.config import settings

router = APIRouter()


@router.get("/executive-summary")
async def executive_summary_report(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    경영진 요약 보고서
    - 총원가 증감
    - 제품군별 주요 변동
    - 핵심 원인 1~2줄
    """
    prev_month = _get_prev_month(yyyymm)

    # 총원가
    total_result = await session.execute(
        text("""
            SELECT yyyymm, SUM(cost_amt) AS total
            FROM snp_cost_result
            WHERE yyyymm IN (:curr, :prev)
            GROUP BY yyyymm
        """),
        {"curr": yyyymm, "prev": prev_month},
    )
    totals = {row[0]: row[1] for row in total_result.fetchall()}

    # 제품군별 상위 변동
    grp_result = await session.execute(
        text("""
            SELECT p.product_grp,
                   SUM(CASE WHEN s.yyyymm = :curr THEN s.cost_amt ELSE 0 END) AS curr,
                   SUM(CASE WHEN s.yyyymm = :prev THEN s.cost_amt ELSE 0 END) AS prev
            FROM snp_cost_result s
            JOIN mst_product p ON s.product_cd = p.product_cd
            WHERE s.yyyymm IN (:curr, :prev)
            GROUP BY p.product_grp
        """),
        {"curr": yyyymm, "prev": prev_month},
    )
    groups = []
    for row in grp_result.fetchall():
        diff = (row[1] or 0) - (row[2] or 0)
        rate = (diff / row[2] * 100) if row[2] else 0
        groups.append({
            "product_grp": row[0],
            "curr": round(row[1] or 0, 2),
            "prev": round(row[2] or 0, 2),
            "diff": round(diff, 2),
            "rate": round(rate, 2),
        })
    groups.sort(key=lambda x: abs(x["diff"]), reverse=True)

    # LLM 알림
    alerts = await run_query("""
        MATCH (v:Variance {yyyymm: $yyyymm})
        WHERE v.llm_alert_level IN ['경고', '긴급']
        RETURN v.product_grp AS grp,
               v.product_cd AS product,
               v.llm_summary AS summary,
               v.llm_alert_level AS alert_level
        ORDER BY CASE v.llm_alert_level
            WHEN '긴급' THEN 1 WHEN '경고' THEN 2 ELSE 3 END
        LIMIT 10
    """, {"yyyymm": yyyymm})

    return {
        "report_type": "경영진 요약",
        "yyyymm": yyyymm,
        "total_cost": {
            "curr": round(totals.get(yyyymm, 0), 2),
            "prev": round(totals.get(prev_month, 0), 2),
        },
        "by_product_group": groups[:settings.REPORT_TOP_N],
        "alerts": alerts,
    }


@router.get("/cost-team")
async def cost_team_report(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    원가팀 보고서
    - 계정/공정별 상세 Drill-down
    - 배부율/배부량 분해 상세
    """
    result = await session.execute(
        text("""
            SELECT product_grp, product_cd, proc_cd, ce_cd, var_type,
                   var_amt, var_rate
            FROM cal_variance
            WHERE yyyymm = :ym AND product_cd IS NOT NULL
            ORDER BY ABS(var_amt) DESC
            LIMIT 50
        """),
        {"ym": yyyymm},
    )
    variances = [dict(zip(result.keys(), row)) for row in result.fetchall()]

    return {
        "report_type": "원가팀 상세",
        "yyyymm": yyyymm,
        "top_variances": variances,
    }


@router.get("/production-team")
async def production_team_report(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    생산팀 보고서
    - MES 이벤트 기반
    - 수율/가동률 변동 → 원가 영향
    """
    # MES 이벤트
    mes_result = await session.execute(
        text("""
            SELECT e.equip_cd, eq.equip_nm, e.metric_type,
                   e.prev_value, e.curr_value, e.chg_value, e.chg_rate
            FROM evt_mes e
            JOIN mst_equipment eq ON e.equip_cd = eq.equip_cd
            WHERE e.yyyymm = :ym
            ORDER BY ABS(e.chg_rate) DESC
        """),
        {"ym": yyyymm},
    )
    mes_events = [dict(zip(mes_result.keys(), row)) for row in mes_result.fetchall()]

    # 관련 원가 영향 (Neo4j)
    cost_impacts = await run_query("""
        MATCH (evt:Event {yyyymm: $yyyymm, source: 'MES'})
              <-[:EVIDENCED_BY]-(v:Variance)
        RETURN evt.target_cd AS equipment,
               v.product_cd AS product,
               v.var_type AS var_type,
               v.var_amt AS var_amt,
               v.var_rate AS var_rate
        ORDER BY abs(v.var_amt) DESC
    """, {"yyyymm": yyyymm})

    return {
        "report_type": "생산팀",
        "yyyymm": yyyymm,
        "mes_events": mes_events,
        "cost_impacts": cost_impacts,
    }


@router.get("/purchase-team")
async def purchase_team_report(
    yyyymm: str = Query(..., description="기준월"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    구매팀 보고서
    - 자재 단가 변동 이벤트
    - 단가 변동 → 원가 영향
    """
    # 구매 이벤트
    pur_result = await session.execute(
        text("""
            SELECT e.event_id, e.mat_cd, m.mat_nm, e.chg_type,
                   e.prev_value, e.curr_value, e.chg_rate, e.chg_reason
            FROM evt_purchase e
            JOIN mst_material m ON e.mat_cd = m.mat_cd
            WHERE e.yyyymm = :ym
            ORDER BY ABS(e.chg_rate) DESC
        """),
        {"ym": yyyymm},
    )
    purchase_events = [dict(zip(pur_result.keys(), row)) for row in pur_result.fetchall()]

    # 관련 원가 영향 (Neo4j)
    cost_impacts = await run_query("""
        MATCH (evt:Event {yyyymm: $yyyymm, source: 'PURCHASE'})
              <-[:EVIDENCED_BY]-(v:Variance)
        RETURN evt.target_cd AS material,
               v.product_cd AS product,
               v.var_type AS var_type,
               v.var_amt AS var_amt,
               v.var_rate AS var_rate
        ORDER BY abs(v.var_amt) DESC
    """, {"yyyymm": yyyymm})

    return {
        "report_type": "구매팀",
        "yyyymm": yyyymm,
        "purchase_events": purchase_events,
        "cost_impacts": cost_impacts,
    }


def _get_prev_month(yyyymm: str) -> str:
    year = int(yyyymm[:4])
    month = int(yyyymm[4:6])
    if month == 1:
        return f"{year - 1}12"
    return f"{year}{month - 1:02d}"
