"""
챗 API
- LLM 기반 자연어 질의응답
- 그래프 탐색 기반 답변
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_session
from app.services.evidence import EvidenceBuilder
from app.services.llm_engine import LLMEngine

router = APIRouter()


class ChatRequest(BaseModel):
    """챗 요청"""
    question: str
    yyyymm: str | None = None


class ChatResponse(BaseModel):
    """챗 응답"""
    answer: str
    question: str
    yyyymm: str | None = None


@router.post("/ask", response_model=ChatResponse)
async def ask_question(
    request: ChatRequest,
    session: AsyncSession = Depends(get_db_session),
):
    """
    자연어 질의응답
    예시:
      - "이번 달 원가가 왜 올랐나요?"
      - "HBM 제품의 배부율이 왜 상승했나요?"
      - "과거에도 이런 패턴이 있었나요?"
    """
    evidence_builder = EvidenceBuilder(session)
    llm_engine = LLMEngine(evidence_builder)
    answer = await llm_engine.chat(request.question, request.yyyymm)

    return ChatResponse(
        answer=answer,
        question=request.question,
        yyyymm=request.yyyymm,
    )
