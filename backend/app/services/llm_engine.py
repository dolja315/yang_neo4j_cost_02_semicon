"""
LLM 해석 엔진 (Step 5)

다중 프로바이더 지원:
  - Azure OpenAI (기본)
  - Anthropic Claude
  - LG EXAONE (FriendliAI)
  - Upstage Solar

핵심 원칙:
  1. LLM은 계산하지 않는다. 해석만 한다.
  2. LLM은 증거 없이 판단하지 않는다.
  3. LLM의 판단에는 항상 신뢰도가 붙는다.

역할:
  - 해석 자동화: 증거 기반 서술형 코멘트 생성
  - 이상 탐지: 통상 변동 범위 이탈 플래깅
  - 질의응답: 그래프 탐색 기반 자연어 답변
"""

import json
from abc import ABC, abstractmethod

from app.config import settings
from app.services.evidence import EvidenceBuilder
from app.db.neo4j_db import run_write_query, run_query


# ──────────────────────────────────────────────────
# LLM 시스템 프롬프트
# ──────────────────────────────────────────────────

SYSTEM_PROMPT = """당신은 반도체 원가 분석 전문가입니다.
주어진 증거를 기반으로 원가 변동의 원인을 분석하고 해석합니다.

규칙:
1. 반드시 제공된 증거만을 기반으로 판단하세요.
2. 계산은 하지 마세요. 이미 계산된 숫자를 해석하세요.
3. 증거가 충분하면 "판단"으로, 부족하면 "추정"으로 구분하세요.
4. 추정인 경우 반드시 "담당자 확인 필요"를 표시하세요.
5. 응답은 반드시 아래 JSON 형식으로 하세요.

응답 형식:
{
  "summary": "1~2문장 요약",
  "root_cause": "주요 원인 설명",
  "classification": "일시적 | 구조적 | 의도적",
  "confidence": "높음 | 중간 | 낮음",
  "alert_level": "정상 | 관찰 | 경고 | 긴급",
  "affected_products": ["영향받는 제품코드 목록"],
  "recommendation": "권고사항",
  "evidence_refs": ["참조한 증거 목록"]
}
"""

CHAT_SYSTEM_PROMPT = "반도체 원가 분석 전문가입니다. 제공된 데이터를 기반으로 답변합니다."


# ──────────────────────────────────────────────────
# LLM 프로바이더 추상 인터페이스
# ──────────────────────────────────────────────────

class BaseLLMProvider(ABC):
    """LLM 프로바이더 추상 클래스"""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """프로바이더 이름"""
        ...

    @abstractmethod
    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        json_mode: bool = False,
    ) -> str:
        """채팅 완성 API 호출 → 텍스트 반환"""
        ...

    def is_available(self) -> bool:
        """프로바이더 사용 가능 여부"""
        return True


# ──────────────────────────────────────────────────
# Azure OpenAI 프로바이더
# ──────────────────────────────────────────────────

class AzureOpenAIProvider(BaseLLMProvider):
    """Azure OpenAI 프로바이더"""

    def __init__(self):
        from openai import AsyncAzureOpenAI
        self.client = AsyncAzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_version=settings.AZURE_OPENAI_API_VERSION,
        )

    @property
    def provider_name(self) -> str:
        return f"Azure OpenAI ({settings.AZURE_OPENAI_DEPLOYMENT_NAME})"

    def is_available(self) -> bool:
        return bool(settings.AZURE_OPENAI_API_KEY)

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        json_mode: bool = False,
    ) -> str:
        kwargs = {
            "model": settings.AZURE_OPENAI_DEPLOYMENT_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        response = await self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content


# ──────────────────────────────────────────────────
# Anthropic Claude 프로바이더
# ──────────────────────────────────────────────────

class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude 프로바이더"""

    def __init__(self):
        from anthropic import AsyncAnthropic
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    @property
    def provider_name(self) -> str:
        return f"Anthropic ({settings.ANTHROPIC_MODEL})"

    def is_available(self) -> bool:
        return bool(settings.ANTHROPIC_API_KEY)

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        json_mode: bool = False,
    ) -> str:
        prompt = user_prompt
        if json_mode:
            prompt += "\n\n반드시 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요."

        response = await self.client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text


# ──────────────────────────────────────────────────
# LG EXAONE 프로바이더 (FriendliAI)
# ──────────────────────────────────────────────────

class ExaoneProvider(BaseLLMProvider):
    """LG EXAONE 프로바이더 (FriendliAI OpenAI-호환 API)"""

    def __init__(self):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(
            api_key=settings.FRIENDLI_API_KEY,
            base_url=settings.FRIENDLI_ENDPOINT,
        )

    @property
    def provider_name(self) -> str:
        return f"LG EXAONE ({settings.FRIENDLI_MODEL})"

    def is_available(self) -> bool:
        return bool(settings.FRIENDLI_API_KEY)

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        json_mode: bool = False,
    ) -> str:
        prompt = user_prompt
        if json_mode:
            prompt += "\n\n반드시 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요."

        response = await self.client.chat.completions.create(
            model=settings.FRIENDLI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content


# ──────────────────────────────────────────────────
# Upstage Solar 프로바이더
# ──────────────────────────────────────────────────

class UpstageProvider(BaseLLMProvider):
    """Upstage Solar 프로바이더 (OpenAI-호환 API)"""

    def __init__(self):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(
            api_key=settings.UPSTAGE_API_KEY,
            base_url=settings.UPSTAGE_ENDPOINT,
        )

    @property
    def provider_name(self) -> str:
        return f"Upstage ({settings.UPSTAGE_MODEL})"

    def is_available(self) -> bool:
        return bool(settings.UPSTAGE_API_KEY)

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        json_mode: bool = False,
    ) -> str:
        prompt = user_prompt
        if json_mode:
            prompt += "\n\n반드시 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요."

        response = await self.client.chat.completions.create(
            model=settings.UPSTAGE_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content


# ──────────────────────────────────────────────────
# 프로바이더 팩토리
# ──────────────────────────────────────────────────

def create_llm_provider(provider_name: str = None) -> BaseLLMProvider | None:
    """LLM 프로바이더 인스턴스 생성

    Args:
        provider_name: 프로바이더 이름. None이면 settings.LLM_PROVIDER 사용.
                       azure_openai | anthropic | exaone | upstage
    """
    name = provider_name or settings.LLM_PROVIDER

    providers = {
        "azure_openai": AzureOpenAIProvider,
        "anthropic": AnthropicProvider,
        "exaone": ExaoneProvider,
        "upstage": UpstageProvider,
    }

    provider_cls = providers.get(name)
    if provider_cls is None:
        print(f"[LLM] 알 수 없는 프로바이더: {name}. 지원: {list(providers.keys())}")
        return None

    try:
        provider = provider_cls()
        if not provider.is_available():
            print(f"[LLM] {provider.provider_name} API 키가 설정되지 않았습니다.")
            return None
        print(f"[LLM] 프로바이더 초기화: {provider.provider_name}")
        return provider
    except ImportError as e:
        print(f"[LLM] {name} 라이브러리 설치 필요: {e}")
        return None
    except Exception as e:
        print(f"[LLM] 프로바이더 초기화 실패: {e}")
        return None


# ──────────────────────────────────────────────────
# LLM 해석 엔진
# ──────────────────────────────────────────────────

class LLMEngine:
    """LLM 해석 엔진 — 다중 프로바이더 지원"""

    def __init__(self, evidence_builder: EvidenceBuilder, provider_name: str = None):
        self.evidence_builder = evidence_builder
        self.provider = create_llm_provider(provider_name)

    async def interpret_variance(self, var_id: str) -> dict:
        """
        단일 차이 노드에 대한 LLM 해석 생성

        흐름:
        1. 증거 패키지 조립
        2. LLM 프롬프트 생성
        3. LLM 호출
        4. 결과 파싱 및 저장
        """
        # 1. 증거 패키지 조립
        evidence = await self.evidence_builder.build_evidence_package(var_id)
        if "error" in evidence:
            return evidence

        # 2. 프롬프트 생성
        prompt = self.evidence_builder.format_for_llm(evidence)

        # 3. LLM 호출
        interpretation = await self._call_llm(prompt)

        # 4. 결과를 Neo4j Variance 노드에 저장
        await self._save_interpretation(var_id, interpretation)

        return interpretation

    async def interpret_all_variances(self, yyyymm: str) -> list[dict]:
        """해당 월의 임계값 초과 차이 노드 전체에 대해 해석 생성"""
        records = await run_query("""
            MATCH (v:Variance {yyyymm: $yyyymm})
            WHERE v.product_cd IS NOT NULL
              AND v.var_type IN ['RATE_VAR', 'QTY_VAR', 'PRICE_VAR', 'USAGE_VAR']
              AND (abs(v.var_rate) >= $rate_threshold OR abs(v.var_amt) >= $amt_threshold)
            RETURN v.var_id AS var_id
            ORDER BY abs(v.var_amt) DESC
        """, {
            "yyyymm": yyyymm,
            "rate_threshold": settings.VARIANCE_RATE_THRESHOLD,
            "amt_threshold": settings.VARIANCE_AMT_THRESHOLD,
        })

        provider_info = self.provider.provider_name if self.provider else "미연결"
        print(f"[LLM] 해석 시작 ({provider_info}): {len(records)}건 대상")

        results = []
        for record in records:
            var_id = record["var_id"]
            interpretation = await self.interpret_variance(var_id)
            results.append({"var_id": var_id, "interpretation": interpretation})

        print(f"[LLM] {len(results)}건 해석 완료")
        return results

    async def chat(self, question: str, yyyymm: str = None) -> str:
        """자연어 질의응답 — 그래프 탐색 결과를 컨텍스트로 제공"""
        context = await self._get_chat_context(question, yyyymm)

        chat_prompt = f"""사용자 질문: {question}

관련 데이터:
{json.dumps(context, ensure_ascii=False, indent=2)}

위 데이터를 기반으로 질문에 답변하세요.
숫자는 이미 계산된 값이므로 그대로 인용하세요.
한국어로 답변하세요.
"""
        if self.provider:
            return await self.provider.chat_completion(
                system_prompt=CHAT_SYSTEM_PROMPT,
                user_prompt=chat_prompt,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
            )
        else:
            return (
                f"[LLM 미연결] 질문: {question}\n\n"
                f"참조 데이터:\n{json.dumps(context, ensure_ascii=False, indent=2)}"
            )

    async def _call_llm(self, prompt: str) -> dict:
        """LLM API 호출 → JSON 결과 반환"""
        if not self.provider:
            return {
                "summary": "[LLM 미연결] 증거 기반 분석이 필요합니다.",
                "root_cause": "LLM API가 연결되지 않아 자동 분석을 수행하지 못했습니다.",
                "classification": "미판정",
                "confidence": "낮음",
                "alert_level": "관찰",
                "affected_products": [],
                "recommendation": f"LLM_PROVIDER={settings.LLM_PROVIDER} 설정을 확인하세요.",
                "evidence_refs": [],
            }

        try:
            content = await self.provider.chat_completion(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=prompt,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
                json_mode=True,
            )
            # JSON 파싱 (코드블록 제거 처리)
            text = content.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            return json.loads(text)
        except json.JSONDecodeError as e:
            return {
                "summary": f"LLM 응답 파싱 오류 (프로바이더: {self.provider.provider_name})",
                "root_cause": f"JSON 파싱 실패: {str(e)}",
                "classification": "미판정",
                "confidence": "낮음",
                "alert_level": "관찰",
                "affected_products": [],
                "recommendation": "재시도 필요",
                "evidence_refs": [],
                "_raw_response": content[:500] if content else "",
            }
        except Exception as e:
            return {
                "summary": f"LLM 해석 중 오류: {str(e)}",
                "root_cause": "오류",
                "classification": "미판정",
                "confidence": "낮음",
                "alert_level": "관찰",
                "affected_products": [],
                "recommendation": "재시도 필요",
                "evidence_refs": [],
            }

    async def _save_interpretation(self, var_id: str, interpretation: dict):
        """LLM 해석 결과를 Variance 노드에 저장"""
        await run_write_query("""
            MATCH (v:Variance {var_id: $var_id})
            SET v.llm_summary = $summary,
                v.llm_classification = $classification,
                v.llm_confidence = $confidence,
                v.llm_alert_level = $alert_level,
                v.llm_recommendation = $recommendation,
                v.llm_provider = $provider,
                v.llm_updated_at = datetime()
        """, {
            "var_id": var_id,
            "summary": interpretation.get("summary", ""),
            "classification": interpretation.get("classification", ""),
            "confidence": interpretation.get("confidence", ""),
            "alert_level": interpretation.get("alert_level", ""),
            "recommendation": interpretation.get("recommendation", ""),
            "provider": self.provider.provider_name if self.provider else "none",
        })

    async def _get_chat_context(self, question: str, yyyymm: str = None) -> dict:
        """질의에 관련된 그래프 컨텍스트 조회"""
        month_filter = yyyymm or ""

        query = """
            MATCH (v:Variance)
            WHERE ($yyyymm = '' OR v.yyyymm = $yyyymm)
              AND v.product_cd IS NOT NULL
              AND v.var_type IN ['RATE_VAR', 'QTY_VAR', 'PRICE_VAR', 'USAGE_VAR']
            RETURN v {.*} AS variance
            ORDER BY abs(v.var_amt) DESC
            LIMIT 20
        """
        records = await run_query(query, {"yyyymm": month_filter})
        return {
            "variances": [r["variance"] for r in records],
            "query_month": month_filter,
        }
