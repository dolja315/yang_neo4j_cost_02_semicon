"""
Neo4j DB 연결 모듈 (Aura 호환)
- 인과관계 그래프 + LLM 탐색용
- 상설 그래프 (Permanent) + 월별 차이 그래프 (Monthly)
- Neo4j Aura: neo4j+ssc:// 프로토콜 사용
"""

from neo4j import AsyncGraphDatabase, AsyncDriver

from app.config import settings


# 드라이버 전역 변수
_driver: AsyncDriver | None = None


async def init_neo4j():
    """Neo4j Aura 연결 초기화"""
    global _driver

    try:
        _driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
        )
        # 연결 테스트
        await _driver.verify_connectivity()
        aura_info = f" (Aura: {settings.AURA_INSTANCENAME})" if settings.AURA_INSTANCENAME else ""
        print(f"[Neo4j] 연결 성공: {settings.NEO4J_URI}{aura_info}")

        # 인덱스 및 제약조건 생성
        await _create_constraints_and_indexes()

    except Exception as e:
        print(f"[Neo4j] 연결 실패 (계속 진행): {e}")
        _driver = None


async def close_neo4j():
    """Neo4j 연결 종료"""
    global _driver
    if _driver:
        await _driver.close()
        print("[Neo4j] 연결 종료")


def get_neo4j_driver() -> AsyncDriver | None:
    """Neo4j 드라이버 제공"""
    return _driver


async def run_query(query: str, parameters: dict = None) -> list:
    """Cypher 쿼리 실행 (읽기 전용)"""
    if _driver is None:
        raise RuntimeError("Neo4j가 연결되지 않았습니다.")

    async with _driver.session(database=settings.NEO4J_DATABASE) as session:
        result = await session.run(query, parameters or {})
        records = [record.data() async for record in result]
        return records


async def run_write_query(query: str, parameters: dict = None) -> None:
    """Cypher 쿼리 실행 (쓰기)"""
    if _driver is None:
        raise RuntimeError("Neo4j가 연결되지 않았습니다.")

    async with _driver.session(database=settings.NEO4J_DATABASE) as session:
        await session.run(query, parameters or {})


async def _create_constraints_and_indexes():
    """유니크 제약조건 및 인덱스 생성"""
    constraints = [
        "CREATE CONSTRAINT IF NOT EXISTS FOR (pg:ProductGroup) REQUIRE pg.grp_cd IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (p:Product) REQUIRE p.prod_cd IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (proc:Process) REQUIRE proc.proc_cd IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (eq:Equipment) REQUIRE eq.equip_cd IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (m:Material) REQUIRE m.mat_cd IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (ce:CostElement) REQUIRE ce.ce_cd IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (v:Variance) REQUIRE v.var_id IS UNIQUE",
        "CREATE CONSTRAINT IF NOT EXISTS FOR (e:Event) REQUIRE e.event_id IS UNIQUE",
    ]

    indexes = [
        "CREATE INDEX IF NOT EXISTS FOR (v:Variance) ON (v.yyyymm)",
        "CREATE INDEX IF NOT EXISTS FOR (v:Variance) ON (v.product_cd)",
        "CREATE INDEX IF NOT EXISTS FOR (v:Variance) ON (v.product_grp)",
        "CREATE INDEX IF NOT EXISTS FOR (v:Variance) ON (v.var_type)",
        "CREATE INDEX IF NOT EXISTS FOR (e:Event) ON (e.yyyymm)",
        "CREATE INDEX IF NOT EXISTS FOR (e:Event) ON (e.source)",
    ]

    if _driver is None:
        return

    async with _driver.session(database=settings.NEO4J_DATABASE) as session:
        for query in constraints + indexes:
            try:
                await session.run(query)
            except Exception as e:
                print(f"[Neo4j] 인덱스/제약조건 생성 경고: {e}")

    print("[Neo4j] 인덱스 및 제약조건 생성 완료")
