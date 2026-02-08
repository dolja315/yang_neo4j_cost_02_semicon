"""
Layer C: 소스시스템 이벤트 데이터 모델
- MES 이벤트 (장비 가동률, 수율)
- PLM 이벤트 (BOM 변경, 스펙 변경)
- 구매 이벤트 (자재 단가 변동)
"""

from sqlalchemy import String, Column, CHAR, Float, Date
from app.db.database import Base


class EvtMes(Base):
    """MES 이벤트 - 장비 가동률, 수율 등 생산 지표 변동"""
    __tablename__ = "evt_mes"

    yyyymm = Column(CHAR(6), primary_key=True, comment="기준월")
    equip_cd = Column(String(20), primary_key=True, comment="장비코드")
    metric_type = Column(String(20), primary_key=True, comment="지표유형 (UTIL/YIELD/CT)")
    prev_value = Column(Float, comment="전월 값")
    curr_value = Column(Float, comment="당월 값")
    chg_value = Column(Float, comment="변동값")
    chg_rate = Column(Float, comment="변동률")


class EvtPlm(Base):
    """PLM 이벤트 - BOM 변경, 스펙 변경 이력"""
    __tablename__ = "evt_plm"

    event_id = Column(String(20), primary_key=True, comment="이벤트ID")
    yyyymm = Column(CHAR(6), comment="기준월")
    product_cd = Column(String(20), comment="제품코드")
    chg_type = Column(String(20), comment="변경유형 (BOM_CHG/SPEC_CHG/RECIPE_CHG)")
    chg_desc = Column(String(500), comment="변경 내용 설명")
    chg_date = Column(Date, comment="변경 일자")


class EvtPurchase(Base):
    """구매 이벤트 - 자재 단가 변동, 공급처 변경"""
    __tablename__ = "evt_purchase"

    event_id = Column(String(20), primary_key=True, comment="이벤트ID")
    yyyymm = Column(CHAR(6), comment="기준월")
    mat_cd = Column(String(20), comment="자재코드")
    chg_type = Column(String(20), comment="변경유형 (PRICE_CHG/SUPPLIER_CHG)")
    prev_value = Column(Float, comment="변경 전 값")
    curr_value = Column(Float, comment="변경 후 값")
    chg_rate = Column(Float, comment="변동률")
    chg_reason = Column(String(500), comment="변동 사유")
