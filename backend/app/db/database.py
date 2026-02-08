"""
PostgreSQL DB 연결 모듈
- 로컬 PostgreSQL 사용
- Layer A~D 테이블 관리
- 비동기 SQLAlchemy (asyncpg)
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    """SQLAlchemy 베이스 클래스"""
    pass


# 엔진/세션 전역 변수
_engine = None
_async_session_factory = None


async def init_db():
    """PostgreSQL DB 초기화 - 엔진 생성 및 테이블 생성"""
    global _engine, _async_session_factory

    # 비동기 엔진 생성
    _engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.POSTGRES_ECHO,
        pool_size=10,
        max_overflow=20,
    )

    # 세션 팩토리
    _async_session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # 테이블 생성
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print(f"[PostgreSQL] 초기화 완료: {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")


async def close_db():
    """PostgreSQL DB 연결 종료"""
    global _engine
    if _engine:
        await _engine.dispose()
        print("[PostgreSQL] 연결 종료")


async def get_db_session() -> AsyncSession:
    """DB 세션 제공 (Dependency Injection용)"""
    if _async_session_factory is None:
        raise RuntimeError("PostgreSQL이 초기화되지 않았습니다. init_db()를 먼저 호출하세요.")
    async with _async_session_factory() as session:
        yield session


async def reset_db():
    """테이블 전체 재생성 (개발용)"""
    global _engine
    if _engine is None:
        await init_db()
        return

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("[PostgreSQL] 테이블 재생성 완료")
