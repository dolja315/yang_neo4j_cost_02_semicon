"""
차이 계산 엔진 (Step 3)
- 전공정 배부 분해: 배부율 차이 + 배부량 차이
- 후공정 재료비 분해: 단가 차이 + 사용량 차이
- 후공정 가공비 분해: 전공정과 동일

핵심 공식:
  전공정:
    배부율 차이 = (R₁ - R₀) × Q₁
    배부량 차이 = R₀ × (Q₁ - Q₀)
    배부율차이 = 총비용변동효과 + 총배부기준변동효과

  후공정 재료비:
    단가 차이 = Σ (P₁ - P₀) × Q₁
    사용량 차이 = Σ P₀ × (Q₁ - Q₀)
"""

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.config import settings


class VarianceCalculator:
    """원가 차이 계산 엔진"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def calculate_all(self, yyyymm: str) -> list[dict]:
        """지정 월의 전체 차이 계산 실행"""
        prev_month = self._get_prev_month(yyyymm)

        results = []

        # 1) 전공정 배부 분해
        fe_variances = await self._calc_fe_allocation_variance(yyyymm, prev_month)
        results.extend(fe_variances)

        # 2) 후공정 재료비 분해
        be_mat_variances = await self._calc_be_material_variance(yyyymm, prev_month)
        results.extend(be_mat_variances)

        # 3) 후공정 가공비 분해 (전공정과 동일 로직)
        be_conv_variances = await self._calc_be_conversion_variance(yyyymm, prev_month)
        results.extend(be_conv_variances)

        # 4) 결과 저장
        await self._save_variances(results)

        return results

    async def _calc_fe_allocation_variance(
        self, yyyymm: str, prev_month: str
    ) -> list[dict]:
        """
        전공정 배부 분해
        배부율 차이: (R₁ - R₀) × Q₁  ← 비용 자체가 변했다
        배부량 차이: R₀ × (Q₁ - Q₀)  ← 제품 Mix가 변했다
        """
        # 당월/전월 배부율 조회
        rate_query = text("""
            SELECT r.yyyymm, r.proc_cd, r.ce_cd, r.total_cost, r.total_base,
                   r.alloc_rate
            FROM snp_alloc_rate r
            JOIN mst_process p ON r.proc_cd = p.proc_cd
            WHERE r.yyyymm IN (:curr, :prev)
              AND p.proc_type = 'FE'
              AND p.alloc_type = 'ALLOC'
        """)
        rate_result = await self.session.execute(
            rate_query, {"curr": yyyymm, "prev": prev_month}
        )
        rates_df = pd.DataFrame(rate_result.fetchall(), columns=rate_result.keys())

        # 당월/전월 배부결과 조회
        alloc_query = text("""
            SELECT a.yyyymm, a.product_cd, a.proc_cd, a.ce_cd,
                   a.alloc_qty, a.alloc_amt
            FROM snp_alloc_result a
            JOIN mst_process p ON a.proc_cd = p.proc_cd
            WHERE a.yyyymm IN (:curr, :prev)
              AND p.proc_type = 'FE'
        """)
        alloc_result = await self.session.execute(
            alloc_query, {"curr": yyyymm, "prev": prev_month}
        )
        alloc_df = pd.DataFrame(alloc_result.fetchall(), columns=alloc_result.keys())

        if rates_df.empty or alloc_df.empty:
            return []

        variances = []

        # 당월/전월 분리
        curr_rates = rates_df[rates_df["yyyymm"] == yyyymm]
        prev_rates = rates_df[rates_df["yyyymm"] == prev_month]
        curr_alloc = alloc_df[alloc_df["yyyymm"] == yyyymm]
        prev_alloc = alloc_df[alloc_df["yyyymm"] == prev_month]

        # 제품별 차이 계산
        for _, curr_row in curr_alloc.iterrows():
            prod = curr_row["product_cd"]
            proc = curr_row["proc_cd"]
            ce = curr_row["ce_cd"]

            # 전월 데이터 매칭
            prev_match = prev_alloc[
                (prev_alloc["product_cd"] == prod)
                & (prev_alloc["proc_cd"] == proc)
                & (prev_alloc["ce_cd"] == ce)
            ]
            if prev_match.empty:
                continue

            Q1 = curr_row["alloc_qty"]  # 당월 배부량
            Q0 = prev_match.iloc[0]["alloc_qty"]  # 전월 배부량

            # 배부율 가져오기
            curr_rate_match = curr_rates[
                (curr_rates["proc_cd"] == proc) & (curr_rates["ce_cd"] == ce)
            ]
            prev_rate_match = prev_rates[
                (prev_rates["proc_cd"] == proc) & (prev_rates["ce_cd"] == ce)
            ]
            if curr_rate_match.empty or prev_rate_match.empty:
                continue

            R1 = curr_rate_match.iloc[0]["alloc_rate"]
            R0 = prev_rate_match.iloc[0]["alloc_rate"]
            C1 = curr_rate_match.iloc[0]["total_cost"]
            C0 = prev_rate_match.iloc[0]["total_cost"]
            B1 = curr_rate_match.iloc[0]["total_base"]
            B0 = prev_rate_match.iloc[0]["total_base"]

            prev_amt = prev_match.iloc[0]["alloc_amt"]
            curr_amt = curr_row["alloc_amt"]

            # 제품군 조회
            grp = await self._get_product_group(prod)

            # 배부율 차이: (R₁ - R₀) × Q₁ / 10,000 → 억원
            rate_var = (R1 - R0) * Q1 / 10000
            # 배부량 차이: R₀ × (Q₁ - Q₀) / 10,000 → 억원
            qty_var = R0 * (Q1 - Q0) / 10000

            # 배부율 분해
            # 총비용 변동 효과: (C₁ - C₀) × Q₁ / B₀ → 억원
            rate_cost_effect = ((C1 - C0) * Q1 / B0) if B0 != 0 else 0
            # 총배부기준 변동 효과: 나머지
            rate_base_effect = rate_var - rate_cost_effect

            var_id_base = f"V{yyyymm}_{prod}_{proc}_{ce}"

            # 배부율 차이
            variances.append(self._make_variance(
                f"{var_id_base}_RV", yyyymm, prod, grp, proc, ce,
                "RATE_VAR", rate_var, prev_amt, curr_amt
            ))
            # 배부량 차이
            variances.append(self._make_variance(
                f"{var_id_base}_QV", yyyymm, prod, grp, proc, ce,
                "QTY_VAR", qty_var, prev_amt, curr_amt
            ))
            # 총비용 변동 효과
            variances.append(self._make_variance(
                f"{var_id_base}_RC", yyyymm, prod, grp, proc, ce,
                "RATE_COST", rate_cost_effect, prev_amt, curr_amt
            ))
            # 총배부기준 변동 효과
            variances.append(self._make_variance(
                f"{var_id_base}_RB", yyyymm, prod, grp, proc, ce,
                "RATE_BASE", rate_base_effect, prev_amt, curr_amt
            ))

        return variances

    async def _calc_be_material_variance(
        self, yyyymm: str, prev_month: str
    ) -> list[dict]:
        """
        후공정 재료비 분해
        단가 차이: Σ (P₁ - P₀) × Q₁  ← 자재 가격이 변했다
        사용량 차이: Σ P₀ × (Q₁ - Q₀) ← BOM이나 수율이 변했다
        """
        bom_query = text("""
            SELECT b.yyyymm, b.product_cd, b.mat_cd,
                   b.std_qty, b.unit_price, b.mat_amt
            FROM snp_bom b
            WHERE b.yyyymm IN (:curr, :prev)
        """)
        result = await self.session.execute(
            bom_query, {"curr": yyyymm, "prev": prev_month}
        )
        bom_df = pd.DataFrame(result.fetchall(), columns=result.keys())

        if bom_df.empty:
            return []

        variances = []
        curr_bom = bom_df[bom_df["yyyymm"] == yyyymm]
        prev_bom = bom_df[bom_df["yyyymm"] == prev_month]

        # 제품별 집계
        products = curr_bom["product_cd"].unique()
        for prod in products:
            curr_items = curr_bom[curr_bom["product_cd"] == prod]
            prev_items = prev_bom[prev_bom["product_cd"] == prod]

            if prev_items.empty:
                continue

            total_price_var = 0.0
            total_usage_var = 0.0

            for _, curr_item in curr_items.iterrows():
                mat = curr_item["mat_cd"]
                prev_match = prev_items[prev_items["mat_cd"] == mat]
                if prev_match.empty:
                    continue

                P1 = curr_item["unit_price"]
                P0 = prev_match.iloc[0]["unit_price"]
                Q1 = curr_item["std_qty"]
                Q0 = prev_match.iloc[0]["std_qty"]

                total_price_var += (P1 - P0) * Q1 / 10000  # → 억원
                total_usage_var += P0 * (Q1 - Q0) / 10000  # → 억원

            prev_total = prev_items["mat_amt"].sum()
            curr_total = curr_items["mat_amt"].sum()
            grp = await self._get_product_group(prod)

            var_id_base = f"V{yyyymm}_{prod}_BE01_MAT"

            # 단가 차이
            variances.append(self._make_variance(
                f"{var_id_base}_PV", yyyymm, prod, grp, "BE_01", "CE_MAT",
                "PRICE_VAR", total_price_var, prev_total, curr_total
            ))
            # 사용량 차이
            variances.append(self._make_variance(
                f"{var_id_base}_UV", yyyymm, prod, grp, "BE_01", "CE_MAT",
                "USAGE_VAR", total_usage_var, prev_total, curr_total
            ))

        return variances

    async def _calc_be_conversion_variance(
        self, yyyymm: str, prev_month: str
    ) -> list[dict]:
        """후공정 가공비 분해 (전공정과 동일한 배부 분해 로직)"""
        rate_query = text("""
            SELECT r.yyyymm, r.proc_cd, r.ce_cd, r.total_cost, r.total_base,
                   r.alloc_rate
            FROM snp_alloc_rate r
            JOIN mst_process p ON r.proc_cd = p.proc_cd
            WHERE r.yyyymm IN (:curr, :prev)
              AND p.proc_type = 'BE'
              AND p.alloc_type = 'ALLOC'
        """)
        rate_result = await self.session.execute(
            rate_query, {"curr": yyyymm, "prev": prev_month}
        )
        rates_df = pd.DataFrame(rate_result.fetchall(), columns=rate_result.keys())

        alloc_query = text("""
            SELECT a.yyyymm, a.product_cd, a.proc_cd, a.ce_cd,
                   a.alloc_qty, a.alloc_amt
            FROM snp_alloc_result a
            JOIN mst_process p ON a.proc_cd = p.proc_cd
            WHERE a.yyyymm IN (:curr, :prev)
              AND p.proc_type = 'BE'
              AND p.alloc_type = 'ALLOC'
        """)
        alloc_result = await self.session.execute(
            alloc_query, {"curr": yyyymm, "prev": prev_month}
        )
        alloc_df = pd.DataFrame(alloc_result.fetchall(), columns=alloc_result.keys())

        if rates_df.empty or alloc_df.empty:
            return []

        # 전공정과 동일 로직 적용 (코드 재사용 가능하나, 명확성을 위해 분리)
        variances = []
        curr_rates = rates_df[rates_df["yyyymm"] == yyyymm]
        prev_rates = rates_df[rates_df["yyyymm"] == prev_month]
        curr_alloc = alloc_df[alloc_df["yyyymm"] == yyyymm]
        prev_alloc = alloc_df[alloc_df["yyyymm"] == prev_month]

        for _, curr_row in curr_alloc.iterrows():
            prod = curr_row["product_cd"]
            proc = curr_row["proc_cd"]
            ce = curr_row["ce_cd"]

            prev_match = prev_alloc[
                (prev_alloc["product_cd"] == prod)
                & (prev_alloc["proc_cd"] == proc)
                & (prev_alloc["ce_cd"] == ce)
            ]
            if prev_match.empty:
                continue

            Q1 = curr_row["alloc_qty"]
            Q0 = prev_match.iloc[0]["alloc_qty"]

            curr_rate_match = curr_rates[
                (curr_rates["proc_cd"] == proc) & (curr_rates["ce_cd"] == ce)
            ]
            prev_rate_match = prev_rates[
                (prev_rates["proc_cd"] == proc) & (prev_rates["ce_cd"] == ce)
            ]
            if curr_rate_match.empty or prev_rate_match.empty:
                continue

            R1 = curr_rate_match.iloc[0]["alloc_rate"]
            R0 = prev_rate_match.iloc[0]["alloc_rate"]

            prev_amt = prev_match.iloc[0]["alloc_amt"]
            curr_amt = curr_row["alloc_amt"]
            grp = await self._get_product_group(prod)

            rate_var = (R1 - R0) * Q1 / 10000  # → 억원
            qty_var = R0 * (Q1 - Q0) / 10000  # → 억원

            var_id_base = f"V{yyyymm}_{prod}_{proc}_{ce}"

            variances.append(self._make_variance(
                f"{var_id_base}_RV", yyyymm, prod, grp, proc, ce,
                "RATE_VAR", rate_var, prev_amt, curr_amt
            ))
            variances.append(self._make_variance(
                f"{var_id_base}_QV", yyyymm, prod, grp, proc, ce,
                "QTY_VAR", qty_var, prev_amt, curr_amt
            ))

        return variances

    async def _save_variances(self, variances: list[dict]):
        """차이 계산 결과를 DB에 저장"""
        if not variances:
            return

        for v in variances:
            await self.session.execute(
                text("""
                    INSERT INTO cal_variance
                    (var_id, yyyymm, product_cd, product_grp, proc_cd, ce_cd,
                     var_type, var_amt, var_rate, prev_amt, curr_amt)
                    VALUES (:var_id, :yyyymm, :product_cd, :product_grp, :proc_cd,
                            :ce_cd, :var_type, :var_amt, :var_rate, :prev_amt, :curr_amt)
                    ON CONFLICT (var_id) DO UPDATE SET
                        var_amt = EXCLUDED.var_amt,
                        var_rate = EXCLUDED.var_rate,
                        prev_amt = EXCLUDED.prev_amt,
                        curr_amt = EXCLUDED.curr_amt
                """),
                v,
            )
        await self.session.commit()
        print(f"[차이계산] {len(variances)}건 저장 완료")

    async def _get_product_group(self, product_cd: str) -> str:
        """제품코드로 제품군 조회"""
        result = await self.session.execute(
            text("SELECT product_grp FROM mst_product WHERE product_cd = :cd"),
            {"cd": product_cd},
        )
        row = result.fetchone()
        return row[0] if row else ""

    @staticmethod
    def _make_variance(
        var_id: str, yyyymm: str, product_cd: str, product_grp: str,
        proc_cd: str, ce_cd: str, var_type: str, var_amt: float,
        prev_amt: float, curr_amt: float,
    ) -> dict:
        """차이 딕셔너리 생성"""
        var_rate = var_amt / prev_amt if prev_amt != 0 else 0.0
        return {
            "var_id": var_id,
            "yyyymm": yyyymm,
            "product_cd": product_cd,
            "product_grp": product_grp,
            "proc_cd": proc_cd,
            "ce_cd": ce_cd,
            "var_type": var_type,
            "var_amt": round(var_amt, 2),
            "var_rate": round(var_rate, 4),
            "prev_amt": round(prev_amt, 2),
            "curr_amt": round(curr_amt, 2),
        }

    @staticmethod
    def _get_prev_month(yyyymm: str) -> str:
        """전월 계산"""
        year = int(yyyymm[:4])
        month = int(yyyymm[4:6])
        if month == 1:
            return f"{year - 1}12"
        return f"{year}{month - 1:02d}"
