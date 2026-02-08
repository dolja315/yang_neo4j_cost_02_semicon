"""
프로젝트 설정 모듈
- 환경변수 기반 설정 관리
- PostgreSQL(로컬) DB 설정
- Neo4j Aura 설정
- 다중 LLM 프로바이더 설정 (Azure OpenAI / Anthropic / Exaone / Upstage)
"""

from pydantic_settings import BaseSettings
from pathlib import Path


# 프로젝트 루트 디렉토리
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # ── 기본 설정 ──
    APP_NAME: str = "반도체 원가 증감 차이분석 시스템"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # ── PostgreSQL 설정 ──
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "semicon_cost"
    POSTGRES_ECHO: bool = True

    @property
    def DATABASE_URL(self) -> str:
        """PostgreSQL 비동기 연결 URL"""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """PostgreSQL 동기 연결 URL (마이그레이션 등)"""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── Neo4j Aura 설정 ──
    NEO4J_URI: str = "neo4j+ssc://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    NEO4J_DATABASE: str = "neo4j"
    AURA_INSTANCEID: str = ""
    AURA_INSTANCENAME: str = ""

    # ── LLM 공통 설정 ──
    # azure_openai | anthropic | exaone | upstage
    LLM_PROVIDER: str = "azure_openai"
    LLM_TEMPERATURE: float = 0.3
    LLM_MAX_TOKENS: int = 2000

    # ── Azure OpenAI 설정 ──
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_VERSION: str = "2024-12-01-preview"
    AZURE_OPENAI_DEPLOYMENT_NAME: str = "gpt-4o"

    # ── Anthropic Claude 설정 ──
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    # ── FriendliAI (LG EXAONE) 설정 ──
    FRIENDLI_API_KEY: str = ""
    FRIENDLI_ENDPOINT: str = "https://api.friendli.ai/serverless/v1"
    FRIENDLI_MODEL: str = "LGAI-EXAONE/EXAONE-4.0.1-32B"

    # ── Upstage Solar 설정 ──
    UPSTAGE_API_KEY: str = ""
    UPSTAGE_ENDPOINT: str = "https://api.upstage.ai/v1/solar"
    UPSTAGE_MODEL: str = "solar-pro"

    # ── 차이 분석 설정 ──
    VARIANCE_RATE_THRESHOLD: float = 0.03    # |var_rate| >= 3%
    VARIANCE_AMT_THRESHOLD: float = 1.0      # |var_amt| >= 1억원
    SPREAD_RATE_THRESHOLD: float = 0.05      # |var_rate| >= 5%
    SIMILAR_LOOKBACK_MONTHS: int = 12        # 최근 12개월

    # ── 보고서 설정 ──
    REPORT_TOP_N: int = 5

    # ── 서버 설정 ──
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    model_config = {
        "env_file": str(BASE_DIR.parent / ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


# 싱글턴 설정 인스턴스
settings = Settings()
