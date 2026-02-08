"""
Layer D: 차이 계산 결과 데이터 모델
- Python 차이 계산 엔진이 생성
- 전공정: RATE_VAR, QTY_VAR, RATE_COST, RATE_BASE
- 후공정 재료비: PRICE_VAR, USAGE_VAR
- 후공정 가공비: RATE_VAR, QTY_VAR
"""

from sqlalchemy import String, Column, CHAR, Float
from app.db.database import Base


class CalVariance(Base):
    """차이 계산 결과"""
    __tablename__ = "cal_variance"

    var_id = Column(String(50), primary_key=True, comment="차이 ID (자동생성)")
    yyyymm = Column(CHAR(6), nullable=False, comment="기준월")
    product_cd = Column(String(20), comment="제품코드 (NULL이면 제품군 레벨)")
    product_grp = Column(String(20), comment="제품군")
    proc_cd = Column(String(20), comment="공정코드")
    ce_cd = Column(String(20), comment="원가요소코드")
    var_type = Column(String(20), nullable=False, comment="차이유형")
    var_amt = Column(Float, comment="차이금액 (억원)")
    var_rate = Column(Float, comment="차이비율")
    prev_amt = Column(Float, comment="전월 금액")
    curr_amt = Column(Float, comment="당월 금액")
