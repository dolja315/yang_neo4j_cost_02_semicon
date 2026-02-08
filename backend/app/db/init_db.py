"""
DB 초기화 모듈
- PostgreSQL 테이블 생성
- Neo4j 상설 그래프 초기 구축
"""

from app.db.database import init_db, reset_db
from app.db.neo4j_db import init_neo4j


async def init_all_databases():
    """모든 DB 초기화"""
    await init_db()
    await init_neo4j()
    print("[DB] 전체 데이터베이스 초기화 완료")
