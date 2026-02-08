"""
증거 패키지 조립 엔진 (Step 5a)

LLM에게 제공할 증거 4종 조립:
  증거 1: 시계열 패턴 (최근 6~12개월 추이)
  증거 2: 이벤트 매칭 (동일 시점 소스시스템 변동)
  증거 3: 파급 분석 (동일 배부기준 공유 제품 동반 변동)
  증거 4: 유사 과거 사례 (비슷한 변동 패턴 + 당시 원인)
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.neo4j_db import run_query


class EvidenceBuilder:
    """증거 패키지 조립"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def build_evidence_package(self, var_id: str) -> dict:
        """특정 차이 노드에 대한 전체 증거 패키지 조립"""
        # 차이 노드 기본 정보 조회
        var_info = await self._get_variance_info(var_id)
        if not var_info:
            return {"error": f"차이 노드를 찾을 수 없습니다: {var_id}"}

        # 4종 증거 병렬 조립
        evidence_1 = await self._get_time_series(var_info)
        evidence_2 = await self._get_matched_events(var_id)
        evidence_3 = await self._get_spread_analysis(var_id)
        evidence_4 = await self._get_similar_past_cases(var_id)

        return {
            "target": var_info,
            "evidence_1_time_series": evidence_1,
            "evidence_2_events": evidence_2,
            "evidence_3_spread": evidence_3,
            "evidence_4_similar_cases": evidence_4,
        }

    async def _get_variance_info(self, var_id: str) -> dict | None:
        """차이 노드 기본 정보 조회 (Neo4j)"""
        records = await run_query("""
            MATCH (v:Variance {var_id: $var_id})
            RETURN v {.*} AS info
        """, {"var_id": var_id})
        return records[0]["info"] if records else None

    async def _get_time_series(self, var_info: dict) -> dict:
        """
        증거 1: 시계열 패턴
        - 최근 6~12개월 추이
        - 이동평균 대비 이탈도
        """
        product_cd = var_info.get("product_cd")
        proc_cd = var_info.get("proc_cd")
        ce_cd = var_info.get("ce_cd")

        if not all([product_cd, proc_cd, ce_cd]):
            return {"data": [], "avg": 0, "deviation": 0}

        result = await self.session.execute(
            text("""
                SELECT yyyymm, cost_amt
                FROM snp_cost_result
                WHERE product_cd = :prod AND proc_cd = :proc AND ce_cd = :ce
                ORDER BY yyyymm DESC
                LIMIT 12
            """),
            {"prod": product_cd, "proc": proc_cd, "ce": ce_cd},
        )
        rows = result.fetchall()

        if len(rows) < 2:
            return {"data": [], "avg": 0, "deviation": 0}

        data = [{"month": r[0], "amount": r[1]} for r in reversed(rows)]
        amounts = [r[1] for r in rows]
        avg = sum(amounts) / len(amounts)
        latest = amounts[0]
        deviation = ((latest - avg) / avg * 100) if avg != 0 else 0

        return {
            "data": data,
            "avg": round(avg, 2),
            "deviation": round(deviation, 2),
            "latest": latest,
        }

    async def _get_matched_events(self, var_id: str) -> list[dict]:
        """
        증거 2: 이벤트 매칭
        - 인과 경로를 통해 연결된 이벤트 조회
        """
        records = await run_query("""
            MATCH (v:Variance {var_id: $var_id})
            OPTIONAL MATCH path = (v)-[:CAUSED_BY*0..3]->(leaf)-[:EVIDENCED_BY]->(evt:Event)
            WHERE evt IS NOT NULL
            RETURN DISTINCT evt {.*} AS event
        """, {"var_id": var_id})
        return [r["event"] for r in records if r["event"]]

    async def _get_spread_analysis(self, var_id: str) -> list[dict]:
        """
        증거 3: 파급 분석
        - 동일 배부기준 공유 제품의 동반 변동
        """
        records = await run_query("""
            MATCH (v:Variance {var_id: $var_id})-[:SPREADS_TO]->(affected:Variance)
            RETURN affected.product_cd AS product_cd,
                   affected.var_amt AS var_amt,
                   affected.var_rate AS var_rate
            ORDER BY abs(affected.var_amt) DESC
        """, {"var_id": var_id})
        return records

    async def _get_similar_past_cases(self, var_id: str) -> list[dict]:
        """
        증거 4: 유사 과거 사례
        - 비슷한 변동 패턴 + 당시 LLM 판정
        """
        records = await run_query("""
            MATCH (v:Variance {var_id: $var_id})-[s:SIMILAR_TO]->(past:Variance)
            RETURN past.yyyymm AS month,
                   past.var_rate AS var_rate,
                   past.llm_classification AS classification,
                   past.llm_summary AS summary,
                   s.similarity AS similarity,
                   s.pattern AS pattern
            ORDER BY s.similarity DESC
            LIMIT 5
        """, {"var_id": var_id})
        return records

    def format_for_llm(self, evidence_package: dict) -> str:
        """증거 패키지를 LLM 프롬프트 형식으로 변환"""
        target = evidence_package["target"]
        ts = evidence_package["evidence_1_time_series"]
        events = evidence_package["evidence_2_events"]
        spread = evidence_package["evidence_3_spread"]
        similar = evidence_package["evidence_4_similar_cases"]

        prompt = f"""[분석 대상]
  제품군: {target.get('product_grp', 'N/A')}
  제품코드: {target.get('product_cd', 'N/A')}
  공정: {target.get('proc_cd', 'N/A')}
  원가요소: {target.get('ce_cd', 'N/A')}
  차이유형: {target.get('var_type', 'N/A')}
  변동금액: {target.get('var_amt', 0):.1f}억원
  변동률: {target.get('var_rate', 0):.1%}

[증거 1: 시계열]
  최근 추이: {', '.join([f"{d['month']}:{d['amount']:.1f}" for d in ts.get('data', [])])}
  이동평균: {ts.get('avg', 0):.1f}
  이탈도: {ts.get('deviation', 0):.1f}%

[증거 2: 동시 발생 이벤트]
"""
        if events:
            for evt in events:
                source = evt.get("source", "N/A")
                desc = evt.get("description", evt.get("event_type", "N/A"))
                prompt += f"  {source}: {desc}\n"
        else:
            prompt += "  해당 없음\n"

        prompt += "\n[증거 3: 파급]\n"
        if spread:
            for s in spread:
                prompt += f"  {s.get('product_cd', 'N/A')}: {s.get('var_rate', 0):.1%}\n"
        else:
            prompt += "  해당 없음\n"

        prompt += "\n[증거 4: 과거 유사 사례]\n"
        if similar:
            for s in similar:
                classification = s.get("classification", "미판정")
                prompt += f"  {s.get('month', 'N/A')}: {s.get('var_rate', 0):.1%} (판정: {classification})\n"
        else:
            prompt += "  해당 없음\n"

        prompt += """
[판단 요청]
  1. 주요 원인
  2. 일시적 vs 구조적
  3. 주의 등급 (정상/관찰/경고/긴급)
  4. 보고 요약 (1~2문장)
"""
        return prompt
