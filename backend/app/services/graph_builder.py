"""
Neo4j 그래프 빌더 (Step 4)
- 4a: 상설 그래프 갱신 (마스터 노드/관계)
- 4b: 차이 노드 생성 (계층적)
- 4c: 이벤트 노드 생성
- 4d: 위치 연결 (OCCURS_AT, OCCURS_IN, RELATES_TO, INVOLVES)

상설 그래프 구조:
  ProductGroup -CONTAINS-> Product -COST_AT-> Process -HAS_SUBPROCESS-> ProcessGroup
  ProcessGroup -HAS_EQUIPMENT-> Equipment
  Process -COST_COMPOSED_OF-> CostElement
  Process -ALLOCATED_BY-> AllocBase
  Product -USES_MATERIAL-> Material
  ProcessGroup -CONSUMES_GAS-> Material (GAS type)
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.neo4j_db import run_write_query, run_query
from app.config import settings


class GraphBuilder:
    """Neo4j 그래프 구축 서비스"""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ─────────────────────────────────────
    # 그래프 초기화
    # ─────────────────────────────────────

    async def clear_graph(self):
        """Neo4j 그래프 전체 삭제 (초기화용)"""
        # 관계 먼저 삭제 → 노드 삭제
        await run_write_query("MATCH ()-[r]->() DELETE r")
        await run_write_query("MATCH (n) DELETE n")
        print("[GraphBuilder] 기존 그래프 데이터 삭제 완료")

    # ─────────────────────────────────────
    # Step 4a: 상설 그래프 갱신
    # ─────────────────────────────────────

    async def build_permanent_graph(self):
        """상설 그래프 전체 구축 (초기 또는 갱신)"""
        # ── 노드 생성 ──
        await self._create_product_group_nodes()
        await self._create_product_nodes()
        await self._create_process_nodes()
        await self._create_process_group_nodes()
        await self._create_equipment_nodes()
        await self._create_material_nodes()
        await self._create_cost_element_nodes()
        await self._create_alloc_base_nodes()
        # ── 관계 생성 ──
        await self._create_structural_relationships()
        print("[GraphBuilder] 상설 그래프 구축 완료")

    async def _create_product_group_nodes(self):
        """제품군 노드 생성"""
        result = await self.session.execute(
            text("SELECT DISTINCT product_grp FROM mst_product")
        )
        for row in result.fetchall():
            await run_write_query("""
                MERGE (pg:ProductGroup {grp_cd: $grp_cd})
                SET pg.grp_nm = $grp_cd, pg.updated_at = datetime()
            """, {"grp_cd": row[0]})

    async def _create_product_nodes(self):
        """제품 노드 생성"""
        result = await self.session.execute(
            text("SELECT product_cd, product_nm, product_grp, proc_type, use_yn FROM mst_product")
        )
        for row in result.fetchall():
            await run_write_query("""
                MERGE (p:Product {prod_cd: $prod_cd})
                SET p.prod_nm = $prod_nm, p.grp_cd = $grp_cd,
                    p.proc_type = $proc_type, p.use_yn = $use_yn,
                    p.updated_at = datetime()
            """, {
                "prod_cd": row[0], "prod_nm": row[1],
                "grp_cd": row[2], "proc_type": row[3], "use_yn": row[4],
            })

    async def _create_process_nodes(self):
        """공정(대공정) 노드 생성"""
        result = await self.session.execute(
            text("SELECT proc_cd, proc_nm, proc_type, proc_grp, alloc_type, alloc_base FROM mst_process")
        )
        for row in result.fetchall():
            await run_write_query("""
                MERGE (proc:Process {proc_cd: $proc_cd})
                SET proc.proc_nm = $proc_nm, proc.proc_type = $proc_type,
                    proc.proc_grp = $proc_grp, proc.alloc_type = $alloc_type,
                    proc.alloc_base = $alloc_base, proc.updated_at = datetime()
            """, {
                "proc_cd": row[0], "proc_nm": row[1], "proc_type": row[2],
                "proc_grp": row[3], "alloc_type": row[4], "alloc_base": row[5],
            })

    async def _create_process_group_nodes(self):
        """공정군(ProcessGroup) 노드 생성 — ETCH, DEP, PHOTO, DIFF, CMP, ASSY, TEST"""
        result = await self.session.execute(
            text("SELECT DISTINCT proc_grp, proc_type FROM mst_process WHERE proc_grp IS NOT NULL")
        )
        for row in result.fetchall():
            pgrp_cd = row[0]
            proc_type = row[1]
            # 공정군 이름 매핑
            pgrp_names = {
                "ETCH": "식각", "DEP": "증착", "PHOTO": "포토",
                "DIFF": "확산", "CMP": "CMP", "ASSY": "조립", "TEST": "테스트",
            }
            pgrp_nm = pgrp_names.get(pgrp_cd, pgrp_cd)
            await run_write_query("""
                MERGE (pg:ProcessGroup {pgrp_cd: $pgrp_cd})
                SET pg.pgrp_nm = $pgrp_nm, pg.proc_type = $proc_type,
                    pg.updated_at = datetime()
            """, {"pgrp_cd": pgrp_cd, "pgrp_nm": pgrp_nm, "proc_type": proc_type})

    async def _create_equipment_nodes(self):
        """장비 노드 생성"""
        result = await self.session.execute(
            text("SELECT equip_cd, equip_nm, proc_cd, fab_cd FROM mst_equipment")
        )
        for row in result.fetchall():
            await run_write_query("""
                MERGE (eq:Equipment {equip_cd: $equip_cd})
                SET eq.equip_nm = $equip_nm, eq.proc_cd = $proc_cd,
                    eq.fab_cd = $fab_cd, eq.updated_at = datetime()
            """, {
                "equip_cd": row[0], "equip_nm": row[1],
                "proc_cd": row[2], "fab_cd": row[3],
            })

    async def _create_material_nodes(self):
        """자재 노드 생성"""
        result = await self.session.execute(
            text("SELECT mat_cd, mat_nm, mat_type, proc_type FROM mst_material")
        )
        for row in result.fetchall():
            await run_write_query("""
                MERGE (m:Material {mat_cd: $mat_cd})
                SET m.mat_nm = $mat_nm, m.mat_type = $mat_type,
                    m.proc_type = $proc_type, m.updated_at = datetime()
            """, {
                "mat_cd": row[0], "mat_nm": row[1],
                "mat_type": row[2], "proc_type": row[3],
            })

    async def _create_cost_element_nodes(self):
        """원가요소 노드 생성"""
        result = await self.session.execute(
            text("SELECT ce_cd, ce_nm, ce_grp FROM mst_cost_element")
        )
        for row in result.fetchall():
            await run_write_query("""
                MERGE (ce:CostElement {ce_cd: $ce_cd})
                SET ce.ce_nm = $ce_nm, ce.ce_grp = $ce_grp,
                    ce.updated_at = datetime()
            """, {"ce_cd": row[0], "ce_nm": row[1], "ce_grp": row[2]})

    async def _create_alloc_base_nodes(self):
        """배부기준 노드 생성"""
        alloc_bases = [
            {"base_cd": "ST", "base_nm": "장비가동시간", "base_unit": "만h"},
            {"base_cd": "BOM", "base_nm": "표준BOM", "base_unit": "개"},
            {"base_cd": "QTY", "base_nm": "생산수량", "base_unit": "개"},
        ]
        for ab in alloc_bases:
            await run_write_query("""
                MERGE (ab:AllocBase {base_cd: $base_cd})
                SET ab.base_nm = $base_nm, ab.base_unit = $base_unit,
                    ab.updated_at = datetime()
            """, ab)

    async def _create_structural_relationships(self):
        """구조적 관계 생성 (GRAPH_DB_SCHEMA.md 준수)"""

        # ── 1) 제품군 → 제품 (CONTAINS) ──
        await run_write_query("""
            MATCH (pg:ProductGroup), (p:Product)
            WHERE pg.grp_cd = p.grp_cd
            MERGE (pg)-[:CONTAINS]->(p)
        """)

        # ── 2) 제품 → 공정 (COST_AT) — 배부결과 기반 ──
        result = await self.session.execute(
            text("SELECT DISTINCT product_cd, proc_cd FROM snp_alloc_result")
        )
        for row in result.fetchall():
            await run_write_query("""
                MATCH (p:Product {prod_cd: $prod_cd}), (proc:Process {proc_cd: $proc_cd})
                MERGE (p)-[:COST_AT]->(proc)
            """, {"prod_cd": row[0], "proc_cd": row[1]})

        # ── 2b) 제품 → BE_01 (COST_AT) — BOM 직접집계 공정 ──
        result = await self.session.execute(
            text("SELECT DISTINCT product_cd FROM snp_cost_result WHERE proc_cd = 'BE_01'")
        )
        for row in result.fetchall():
            await run_write_query("""
                MATCH (p:Product {prod_cd: $prod_cd}), (proc:Process {proc_cd: 'BE_01'})
                MERGE (p)-[:COST_AT]->(proc)
            """, {"prod_cd": row[0]})

        # ── 3) 대공정 → 공정군 (HAS_SUBPROCESS) ──
        await run_write_query("""
            MATCH (proc:Process), (pg:ProcessGroup)
            WHERE proc.proc_grp = pg.pgrp_cd
            MERGE (proc)-[:HAS_SUBPROCESS]->(pg)
        """)

        # ── 4) 공정군 → 장비 (HAS_EQUIPMENT) ──
        #   Equipment.proc_cd → Process.proc_cd → Process.proc_grp = ProcessGroup.pgrp_cd
        await run_write_query("""
            MATCH (pg:ProcessGroup)<-[:HAS_SUBPROCESS]-(proc:Process),
                  (eq:Equipment)
            WHERE eq.proc_cd = proc.proc_cd
            MERGE (pg)-[:HAS_EQUIPMENT]->(eq)
        """)

        # ── 5) 공정 → 원가요소 (COST_COMPOSED_OF) ──
        result = await self.session.execute(
            text("SELECT DISTINCT proc_cd, ce_cd FROM snp_alloc_rate")
        )
        for row in result.fetchall():
            await run_write_query("""
                MATCH (proc:Process {proc_cd: $proc_cd}), (ce:CostElement {ce_cd: $ce_cd})
                MERGE (proc)-[:COST_COMPOSED_OF]->(ce)
            """, {"proc_cd": row[0], "ce_cd": row[1]})

        # ── 5b) BE_01 → CE_MAT (직접집계 원가요소) ──
        await run_write_query("""
            MATCH (proc:Process {proc_cd: 'BE_01'}), (ce:CostElement {ce_cd: 'CE_MAT'})
            MERGE (proc)-[:COST_COMPOSED_OF]->(ce)
        """)

        # ── 6) 공정 → 배부기준 (ALLOCATED_BY) ──
        await run_write_query("""
            MATCH (proc:Process), (ab:AllocBase)
            WHERE proc.alloc_base = ab.base_cd
            MERGE (proc)-[:ALLOCATED_BY]->(ab)
        """)

        # ── 7) 제품 → 자재 (USES_MATERIAL) — BOM 기반 ──
        result = await self.session.execute(
            text("""
                SELECT DISTINCT product_cd, mat_cd, std_qty, unit_price
                FROM snp_bom
                WHERE yyyymm = (SELECT MAX(yyyymm) FROM snp_bom)
            """)
        )
        for row in result.fetchall():
            await run_write_query("""
                MATCH (p:Product {prod_cd: $prod_cd}), (m:Material {mat_cd: $mat_cd})
                MERGE (p)-[r:USES_MATERIAL]->(m)
                SET r.std_qty = $std_qty, r.unit_price = $unit_price
            """, {
                "prod_cd": row[0], "mat_cd": row[1],
                "std_qty": row[2], "unit_price": row[3],
            })

        # ── 8) 공정군 → 기료 (CONSUMES_GAS) — FE 가스 자재 ──
        #   mat_nm 기반 매칭: Etch_Gas → ETCH, Dep_Gas → DEP
        gas_mapping = [
            {"pgrp_cd": "ETCH", "mat_cd": "MAT_G01"},
            {"pgrp_cd": "DEP",  "mat_cd": "MAT_G02"},
        ]
        for gm in gas_mapping:
            await run_write_query("""
                MATCH (pg:ProcessGroup {pgrp_cd: $pgrp_cd}), (m:Material {mat_cd: $mat_cd})
                MERGE (pg)-[:CONSUMES_GAS]->(m)
            """, gm)

    # ─────────────────────────────────────
    # Step 4b: 차이 노드 생성
    # ─────────────────────────────────────

    async def create_variance_nodes(self, yyyymm: str):
        """차이 노드 생성 + 위치 연결"""
        result = await self.session.execute(
            text("SELECT * FROM cal_variance WHERE yyyymm = :ym"),
            {"ym": yyyymm},
        )
        rows = result.fetchall()
        columns = result.keys()

        for row in rows:
            data = dict(zip(columns, row))

            # Variance 노드 생성
            await run_write_query("""
                MERGE (v:Variance {var_id: $var_id})
                SET v.yyyymm = $yyyymm,
                    v.product_grp = $product_grp,
                    v.product_cd = $product_cd,
                    v.proc_cd = $proc_cd,
                    v.ce_cd = $ce_cd,
                    v.var_type = $var_type,
                    v.var_amt = $var_amt,
                    v.var_rate = $var_rate,
                    v.prev_amt = $prev_amt,
                    v.curr_amt = $curr_amt,
                    v.level = CASE WHEN $product_cd IS NULL THEN 'GROUP' ELSE 'PRODUCT' END,
                    v.created_at = datetime()
            """, data)

            # 위치 연결: OCCURS_AT (제품)
            if data.get("product_cd"):
                await run_write_query("""
                    MATCH (v:Variance {var_id: $var_id}), (p:Product {prod_cd: $prod_cd})
                    MERGE (v)-[:OCCURS_AT]->(p)
                """, {"var_id": data["var_id"], "prod_cd": data["product_cd"]})

            # 위치 연결: OCCURS_IN (공정)
            if data.get("proc_cd"):
                await run_write_query("""
                    MATCH (v:Variance {var_id: $var_id}), (proc:Process {proc_cd: $proc_cd})
                    MERGE (v)-[:OCCURS_IN]->(proc)
                """, {"var_id": data["var_id"], "proc_cd": data["proc_cd"]})

            # 위치 연결: RELATES_TO (원가요소)
            if data.get("ce_cd"):
                await run_write_query("""
                    MATCH (v:Variance {var_id: $var_id}), (ce:CostElement {ce_cd: $ce_cd})
                    MERGE (v)-[:RELATES_TO]->(ce)
                """, {"var_id": data["var_id"], "ce_cd": data["ce_cd"]})

        print(f"[GraphBuilder] 차이 노드 {len(rows)}건 생성 완료")

    # ─────────────────────────────────────
    # Step 4c: 이벤트 노드 생성
    # ─────────────────────────────────────

    async def create_event_nodes(self, yyyymm: str):
        """이벤트 노드 생성 + 대상 연결"""
        await self._create_mes_events(yyyymm)
        await self._create_plm_events(yyyymm)
        await self._create_purchase_events(yyyymm)
        print(f"[GraphBuilder] 이벤트 노드 생성 완료")

    async def _create_mes_events(self, yyyymm: str):
        """MES 이벤트 노드 생성"""
        result = await self.session.execute(
            text("SELECT * FROM evt_mes WHERE yyyymm = :ym"), {"ym": yyyymm}
        )
        for row in result.fetchall():
            data = dict(zip(result.keys(), row))
            event_id = f"MES_{yyyymm}_{data['equip_cd']}_{data['metric_type']}"

            await run_write_query("""
                MERGE (e:Event {event_id: $event_id})
                SET e.yyyymm = $yyyymm, e.source = 'MES',
                    e.event_type = $metric_type + '_CHG',
                    e.target_cd = $equip_cd,
                    e.metric_type = $metric_type,
                    e.prev_value = $prev_value,
                    e.curr_value = $curr_value,
                    e.chg_value = $chg_value,
                    e.chg_rate = $chg_rate,
                    e.created_at = datetime()
            """, {
                "event_id": event_id, "yyyymm": yyyymm,
                "metric_type": data["metric_type"],
                "equip_cd": data["equip_cd"],
                "prev_value": data["prev_value"],
                "curr_value": data["curr_value"],
                "chg_value": data["chg_value"],
                "chg_rate": data["chg_rate"],
            })

            # 장비 연결
            await run_write_query("""
                MATCH (e:Event {event_id: $event_id}), (eq:Equipment {equip_cd: $equip_cd})
                MERGE (e)-[:INVOLVES]->(eq)
            """, {"event_id": event_id, "equip_cd": data["equip_cd"]})

    async def _create_plm_events(self, yyyymm: str):
        """PLM 이벤트 노드 생성"""
        result = await self.session.execute(
            text("SELECT * FROM evt_plm WHERE yyyymm = :ym"), {"ym": yyyymm}
        )
        for row in result.fetchall():
            data = dict(zip(result.keys(), row))
            await run_write_query("""
                MERGE (e:Event {event_id: $event_id})
                SET e.yyyymm = $yyyymm, e.source = 'PLM',
                    e.event_type = $chg_type,
                    e.target_cd = $product_cd,
                    e.description = $chg_desc,
                    e.created_at = datetime()
            """, {
                "event_id": data["event_id"], "yyyymm": yyyymm,
                "chg_type": data["chg_type"],
                "product_cd": data["product_cd"],
                "chg_desc": data["chg_desc"],
            })

            # 제품 연결
            await run_write_query("""
                MATCH (e:Event {event_id: $event_id}), (p:Product {prod_cd: $prod_cd})
                MERGE (e)-[:INVOLVES]->(p)
            """, {"event_id": data["event_id"], "prod_cd": data["product_cd"]})

    async def _create_purchase_events(self, yyyymm: str):
        """구매 이벤트 노드 생성"""
        result = await self.session.execute(
            text("SELECT * FROM evt_purchase WHERE yyyymm = :ym"), {"ym": yyyymm}
        )
        for row in result.fetchall():
            data = dict(zip(result.keys(), row))
            await run_write_query("""
                MERGE (e:Event {event_id: $event_id})
                SET e.yyyymm = $yyyymm, e.source = 'PURCHASE',
                    e.event_type = $chg_type,
                    e.target_cd = $mat_cd,
                    e.prev_value = $prev_value,
                    e.curr_value = $curr_value,
                    e.chg_rate = $chg_rate,
                    e.description = $chg_reason,
                    e.created_at = datetime()
            """, {
                "event_id": data["event_id"], "yyyymm": yyyymm,
                "chg_type": data["chg_type"],
                "mat_cd": data["mat_cd"],
                "prev_value": data["prev_value"],
                "curr_value": data["curr_value"],
                "chg_rate": data["chg_rate"],
                "chg_reason": data["chg_reason"],
            })

            # 자재 연결
            await run_write_query("""
                MATCH (e:Event {event_id: $event_id}), (m:Material {mat_cd: $mat_cd})
                MERGE (e)-[:INVOLVES]->(m)
            """, {"event_id": data["event_id"], "mat_cd": data["mat_cd"]})
