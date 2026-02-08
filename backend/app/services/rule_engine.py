"""
인과관계 자동 생성 규칙 엔진 (Step 4d)

규칙 체계:
  Rule 1: 제품 원가 차이 → 원가요소별 분해 연결
  Rule 2: 배부율 차이 → 총비용/총배부기준량 분해 연결
  Rule 3: 배부기준량(ST) 변동 → MES 이벤트 매칭
  Rule 4: 재료비 변동 → 구매/PLM 이벤트 매칭
  Rule 5: 파급 관계 생성
  Rule 6: 유사 과거 사례 매칭
"""

from app.db.neo4j_db import run_write_query, run_query
from app.config import settings


class RuleEngine:
    """인과관계 규칙 엔진"""

    async def execute_all_rules(self, yyyymm: str):
        """전체 규칙 순차 실행"""
        print(f"[RuleEngine] 규칙 엔진 시작: {yyyymm}")

        await self.rule_01_cost_decomposition(yyyymm)
        await self.rule_02_rate_decomposition(yyyymm)
        await self.rule_03_mes_event_matching(yyyymm)
        await self.rule_04_material_event_matching(yyyymm)
        await self.rule_05_spread_relationship(yyyymm)
        await self.rule_06_similar_past_cases(yyyymm)

        print(f"[RuleEngine] 규칙 엔진 완료: {yyyymm}")

    async def rule_01_cost_decomposition(self, yyyymm: str):
        """
        Rule 1: 제품 원가 차이 → 원가요소별 분해
        같은 제품·공정 내 RATE_VAR ↔ QTY_VAR, PRICE_VAR ↔ USAGE_VAR 쌍을
        CAUSED_BY로 연결 (TOTAL_VAR 노드가 없으면 쌍 연결 방식)

        또한, TOTAL_VAR 노드가 있을 때는 TOTAL_VAR → 세부 차이로 연결
        """
        # 1a: TOTAL_VAR → 세부 차이 (TOTAL_VAR이 있는 경우)
        await run_write_query("""
            MATCH (total:Variance {yyyymm: $yyyymm, var_type: 'TOTAL_VAR'})
            WHERE total.product_cd IS NOT NULL
            MATCH (detail:Variance {yyyymm: $yyyymm, product_cd: total.product_cd})
            WHERE detail.var_type IN ['RATE_VAR', 'QTY_VAR', 'PRICE_VAR', 'USAGE_VAR']
              AND abs(detail.var_amt) > 0
            WITH total, detail,
                 abs(detail.var_amt) AS abs_amt
            WITH total, collect({node: detail, amt: abs_amt}) AS details,
                 sum(abs_amt) AS total_abs
            UNWIND details AS d
            WITH total, d.node AS detail,
                 CASE WHEN total_abs > 0 THEN d.amt / total_abs ELSE 0 END AS contrib
            MERGE (total)-[:CAUSED_BY {
                contribution: contrib,
                rule_id: 'RULE_01',
                created_at: datetime()
            }]->(detail)
        """, {"yyyymm": yyyymm})

        # 1b: RATE_VAR ← QTY_VAR 쌍 연결 (같은 제품·공정·원가요소)
        await run_write_query("""
            MATCH (rv:Variance {yyyymm: $yyyymm, var_type: 'RATE_VAR'})
            WHERE rv.product_cd IS NOT NULL
            MATCH (qv:Variance {
                yyyymm: $yyyymm,
                var_type: 'QTY_VAR',
                product_cd: rv.product_cd,
                proc_cd: rv.proc_cd,
                ce_cd: rv.ce_cd
            })
            WITH rv, qv,
                 abs(rv.var_amt) + abs(qv.var_amt) AS total_abs
            WHERE total_abs > 0
            MERGE (rv)-[:CAUSED_BY {
                contribution: abs(rv.var_amt) / total_abs,
                rule_id: 'RULE_01',
                created_at: datetime()
            }]->(qv)
        """, {"yyyymm": yyyymm})

        # 1c: PRICE_VAR ← USAGE_VAR 쌍 연결 (같은 제품·공정·원가요소)
        await run_write_query("""
            MATCH (pv:Variance {yyyymm: $yyyymm, var_type: 'PRICE_VAR'})
            WHERE pv.product_cd IS NOT NULL
            MATCH (uv:Variance {
                yyyymm: $yyyymm,
                var_type: 'USAGE_VAR',
                product_cd: pv.product_cd,
                proc_cd: pv.proc_cd,
                ce_cd: pv.ce_cd
            })
            WITH pv, uv,
                 abs(pv.var_amt) + abs(uv.var_amt) AS total_abs
            WHERE total_abs > 0
            MERGE (pv)-[:CAUSED_BY {
                contribution: abs(pv.var_amt) / total_abs,
                rule_id: 'RULE_01',
                created_at: datetime()
            }]->(uv)
        """, {"yyyymm": yyyymm})
        print("  [Rule 1] 원가요소별 분해 연결 완료")

    async def rule_02_rate_decomposition(self, yyyymm: str):
        """
        Rule 2: 배부율 차이 → 총비용/총배부기준량 분해
        RATE_VAR → RATE_COST + RATE_BASE
        """
        await run_write_query("""
            MATCH (rate:Variance {yyyymm: $yyyymm, var_type: 'RATE_VAR'})
            WHERE rate.product_cd IS NOT NULL

            MATCH (sub:Variance {
                yyyymm: $yyyymm,
                product_cd: rate.product_cd,
                proc_cd: rate.proc_cd,
                ce_cd: rate.ce_cd
            })
            WHERE sub.var_type IN ['RATE_COST', 'RATE_BASE']

            WITH rate, sub,
                 CASE WHEN abs(rate.var_amt) > 0
                      THEN abs(sub.var_amt) / abs(rate.var_amt)
                      ELSE 0 END AS contrib

            MERGE (rate)-[:CAUSED_BY {
                contribution: contrib,
                rule_id: 'RULE_02',
                created_at: datetime()
            }]->(sub)
        """, {"yyyymm": yyyymm})
        print("  [Rule 2] 배부율 분해 연결 완료")

    async def rule_03_mes_event_matching(self, yyyymm: str):
        """
        Rule 3: 배부기준량(ST) 변동 → MES 이벤트 매칭
        RATE_BASE 노드 ← 같은 공정 장비의 가동률 변동 이벤트

        경로: Variance -OCCURS_IN-> Process -HAS_SUBPROCESS-> ProcessGroup
              -HAS_EQUIPMENT-> Equipment <-INVOLVES- Event
        """
        await run_write_query("""
            MATCH (rb:Variance {yyyymm: $yyyymm, var_type: 'RATE_BASE'})
            MATCH (rb)-[:OCCURS_IN]->(proc:Process)
                  -[:HAS_SUBPROCESS]->(pg:ProcessGroup)
                  -[:HAS_EQUIPMENT]->(eq:Equipment)
            MATCH (evt:Event {yyyymm: $yyyymm, source: 'MES'})
                  -[:INVOLVES]->(eq)
            WHERE evt.event_type = 'UTIL_CHG'

            MERGE (rb)-[:EVIDENCED_BY {
                match_score: 0.9,
                rule_id: 'RULE_03',
                created_at: datetime()
            }]->(evt)
        """, {"yyyymm": yyyymm})
        print("  [Rule 3] MES 이벤트 매칭 완료")

    async def rule_04_material_event_matching(self, yyyymm: str):
        """
        Rule 4: 재료비 변동 → 구매/PLM 이벤트 매칭
        PRICE_VAR → 구매 이벤트, USAGE_VAR → PLM 이벤트
        """
        # 4a: 단가 차이 → 구매 이벤트
        await run_write_query("""
            MATCH (pv:Variance {yyyymm: $yyyymm, var_type: 'PRICE_VAR'})
            MATCH (pv)-[:OCCURS_AT]->(prod:Product)-[:USES_MATERIAL]->(mat:Material)
            MATCH (evt:Event {yyyymm: $yyyymm, source: 'PURCHASE', event_type: 'PRICE_CHG'})
                  -[:INVOLVES]->(mat)

            MERGE (pv)-[:EVIDENCED_BY {
                match_score: 0.95,
                rule_id: 'RULE_04a',
                created_at: datetime()
            }]->(evt)
        """, {"yyyymm": yyyymm})

        # 4b: 사용량 차이 → PLM 이벤트
        await run_write_query("""
            MATCH (uv:Variance {yyyymm: $yyyymm, var_type: 'USAGE_VAR'})
            MATCH (uv)-[:OCCURS_AT]->(prod:Product)
            MATCH (evt:Event {yyyymm: $yyyymm, source: 'PLM', event_type: 'BOM_CHG'})
                  -[:INVOLVES]->(prod)

            MERGE (uv)-[:EVIDENCED_BY {
                match_score: 0.85,
                rule_id: 'RULE_04b',
                created_at: datetime()
            }]->(evt)
        """, {"yyyymm": yyyymm})
        print("  [Rule 4] 재료비 이벤트 매칭 완료")

    async def rule_05_spread_relationship(self, yyyymm: str):
        """
        Rule 5: 파급 관계 생성
        배부율 차이가 임계값 초과 시, 동일 배부기준 공유 제품 간 SPREADS_TO
        """
        threshold = settings.SPREAD_RATE_THRESHOLD

        await run_write_query("""
            MATCH (v1:Variance {yyyymm: $yyyymm, var_type: 'RATE_VAR'})
            WHERE abs(v1.var_rate) >= $threshold
              AND v1.product_cd IS NOT NULL

            MATCH (v2:Variance {
                yyyymm: $yyyymm,
                var_type: 'RATE_VAR',
                proc_cd: v1.proc_cd,
                ce_cd: v1.ce_cd
            })
            WHERE v2.product_cd IS NOT NULL
              AND v2.product_cd <> v1.product_cd

            MERGE (v1)-[:SPREADS_TO {
                same_alloc_base: v1.proc_cd,
                rule_id: 'RULE_05',
                created_at: datetime()
            }]->(v2)
        """, {"yyyymm": yyyymm, "threshold": threshold})
        print("  [Rule 5] 파급 관계 생성 완료")

    async def rule_06_similar_past_cases(self, yyyymm: str):
        """
        Rule 6: 유사 과거 사례 매칭
        같은 공정 + 원가요소 + 비슷한 변동 크기의 과거 차이 노드를 SIMILAR_TO로 연결
        """
        lookback = settings.SIMILAR_LOOKBACK_MONTHS
        # 과거 범위 시작월 계산
        year = int(yyyymm[:4])
        month = int(yyyymm[4:6])
        start_month = month - lookback
        start_year = year
        while start_month <= 0:
            start_month += 12
            start_year -= 1
        min_yyyymm = f"{start_year}{start_month:02d}"

        await run_write_query("""
            MATCH (curr:Variance {yyyymm: $yyyymm})
            WHERE curr.var_type IN ['RATE_VAR', 'QTY_VAR', 'PRICE_VAR', 'USAGE_VAR']
              AND curr.product_cd IS NOT NULL
              AND abs(curr.var_rate) >= 0.03

            MATCH (past:Variance)
            WHERE past.proc_cd = curr.proc_cd
              AND past.ce_cd = curr.ce_cd
              AND past.var_type = curr.var_type
              AND past.yyyymm < $yyyymm
              AND past.yyyymm >= $min_yyyymm
              AND abs(past.var_rate - curr.var_rate) / abs(curr.var_rate) < 0.5
              AND sign(past.var_amt) = sign(curr.var_amt)

            WITH curr, past,
                 1.0 - abs(past.var_rate - curr.var_rate) / abs(curr.var_rate) AS similarity

            MERGE (curr)-[:SIMILAR_TO {
                similarity: similarity,
                pattern: CASE
                    WHEN curr.var_type = 'RATE_VAR' AND curr.var_amt > 0 THEN 'RATE_INCREASE'
                    WHEN curr.var_type = 'RATE_VAR' AND curr.var_amt < 0 THEN 'RATE_DECREASE'
                    ELSE curr.var_type
                END,
                rule_id: 'RULE_06',
                created_at: datetime()
            }]->(past)
        """, {"yyyymm": yyyymm, "min_yyyymm": min_yyyymm})
        print("  [Rule 6] 유사 과거 사례 매칭 완료")
