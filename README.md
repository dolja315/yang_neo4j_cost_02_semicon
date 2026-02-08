# 반도체 원가 증감 차이분석 시스템

반도체 원가의 전월 대비 차이분석을 자동화하여, 숫자 분해뿐 아니라 원인 해석까지 LLM이 수행하는 시스템입니다.

## 시스템 아키텍처

```
[SQLite/Oracle] ─── 스냅샷 적재 + 차이 계산 (Python)
[Neo4j]         ─── 인과관계 그래프 + LLM 탐색용
[LLM 엔진]      ─── 증거 기반 자동 해석
[웹 UI]         ─── 대시보드 + 챗 + 자동 보고서
```

## 프로젝트 구조

```
├── context/                          # 프로젝트 기획 문서
│   ├── PROJECT_SPEC.md               # 전체 기획서
│   ├── DATA_PREPARATION.md           # 데이터 설계 + 샘플 정의
│   └── GRAPH_DB_SCHEMA.md            # Neo4j 스키마 정의
│
├── backend/                          # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py                   # 엔트리포인트
│   │   ├── config.py                 # 설정 관리
│   │   ├── models/                   # SQLAlchemy 데이터 모델
│   │   │   ├── master.py             # Layer A: 마스터 (제품, 공정, 장비, 자재)
│   │   │   ├── snapshot.py           # Layer B: SAP 스냅샷 (원가, 배부, BOM)
│   │   │   ├── event.py              # Layer C: 이벤트 (MES, PLM, 구매)
│   │   │   └── variance.py           # Layer D: 차이 계산 결과
│   │   ├── db/                       # DB 연결
│   │   │   ├── sqlite_db.py          # SQLite (프로토타입)
│   │   │   ├── neo4j_db.py           # Neo4j 그래프 DB
│   │   │   └── init_db.py            # 초기화
│   │   ├── services/                 # 비즈니스 로직
│   │   │   ├── variance_calc.py      # 차이 계산 엔진 (Step 3)
│   │   │   ├── graph_builder.py      # 그래프 빌더 (Step 4)
│   │   │   ├── rule_engine.py        # 인과관계 규칙 엔진 (Step 4d)
│   │   │   ├── evidence.py           # 증거 패키지 조립 (Step 5a)
│   │   │   └── llm_engine.py         # LLM 해석 엔진 (Step 5)
│   │   ├── api/                      # REST API 엔드포인트
│   │   │   ├── dashboard.py          # 대시보드 (6단계 Drill-down)
│   │   │   ├── analysis.py           # 분석 실행
│   │   │   ├── chat.py               # 자연어 질의응답
│   │   │   └── report.py             # 부서별 보고서
│   │   └── scripts/                  # 실행 스크립트
│   │       ├── generate_sample_data.py  # 샘플 데이터 생성
│   │       └── monthly_process.py       # 월별 실행 프로세스
│   └── requirements.txt
│
├── frontend/                         # React 프론트엔드
│   ├── src/
│   │   ├── App.tsx                   # 메인 레이아웃 + 라우팅
│   │   ├── components/
│   │   │   ├── Dashboard/            # 대시보드 뷰
│   │   │   ├── Analysis/             # 분석 실행 뷰
│   │   │   ├── Chat/                 # 질의응답 뷰
│   │   │   └── Report/               # 보고서 뷰
│   │   └── services/
│   │       └── api.ts                # API 통신 모듈
│   └── package.json
│
├── .env.example                      # 환경변수 예시
├── .gitignore
└── README.md
```

## 핵심 기능

### Drill-down 6단계 분석

| Level | 내용 | 질문 |
|-------|------|------|
| 0 | 총괄 요약 | "이번 달 원가가 얼마나 변했나?" |
| 1 | 계정별 증감 | "어떤 비용이 올랐나?" |
| 2 | 제품군별 증감 | "어떤 제품군이 문제인가?" |
| 3 | 제품코드별 분해 | "왜 올랐나? 비용인가, 물량인가?" |
| 4 | 배부기준 분석 | "비용이 늘었나, 분모가 줄었나?" |
| 5 | 소스시스템 연계 | "실물에서 무슨 일이 있었나?" |

### 차이 분해 로직

- **전공정**: 배부율 차이 + 배부량 차이 (C안: 교차차이 흡수)
- **후공정 재료비**: 단가 차이 + 사용량 차이
- **후공정 가공비**: 배부율 차이 + 배부량 차이

### LLM 해석 원칙

1. LLM은 계산하지 않는다. 해석만 한다.
2. LLM은 증거 없이 판단하지 않는다.
3. LLM의 판단에는 항상 신뢰도가 붙는다.

### 부서별 뷰

| 뷰 | 대상 | 핵심 관심사 |
|----|------|------------|
| 경영진 | CEO, CFO | 제품군별 원가 증감 + 핵심 원인 |
| 원가팀 | 원가 담당자 | 계정/공정별 상세 Drill-down |
| 생산팀 | 생산 담당자 | 수율/가동률 → 원가 영향 |
| 구매팀 | 구매 담당자 | 자재 단가 → 원가 영향 |

## 빠른 시작

### 1. 환경 설정

```bash
# .env 파일 생성
cp .env.example .env
# .env 파일에서 Neo4j, OpenAI API 키 설정
```

### 2. 백엔드 실행

```bash
cd backend
pip install -r requirements.txt

# 샘플 데이터 생성
python -m app.scripts.generate_sample_data

# 서버 실행
uvicorn app.main:app --reload --port 8000
```

### 3. 월별 프로세스 실행 (선택)

```bash
# 차이 계산 → 그래프 구축 → LLM 해석 전체 실행
python -m app.scripts.monthly_process 202501
```

### 4. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

### 5. 접속

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8000
- API 문서: http://localhost:8000/docs

## 기술 스택

| 구분 | 기술 |
|------|------|
| 분석용 DB | SQLite (프로토타입) / Oracle (운영) |
| 그래프 DB | Neo4j |
| 차이 계산 | Python (pandas, numpy) |
| LLM | OpenAI GPT-4o |
| 백엔드 | Python (FastAPI) |
| 프론트엔드 | React + TypeScript + Vite |

## 프로토타입 범위

### 포함
- 샘플 데이터 기반 전체 흐름
- 전공정/후공정 차이 분해 로직
- Neo4j 그래프 (상설 + 월별 차이)
- 규칙 기반 인과관계 자동 생성 (Rule 1~6)
- LLM 해석 자동화 (증거 기반)
- 대시보드 (Drill-down 6단계)
- 부서별 뷰 4종

### 미포함 (추후)
- SAP 실데이터 연동
- 계획 대비 차이분석
- 실시간 알림
- 보안/권한 관리
