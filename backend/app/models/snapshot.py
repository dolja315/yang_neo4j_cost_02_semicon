"""
Layer B: SAP 스냅샷 데이터 모델
- 원가결과, 배부율, 배부결과, BOM
"""

from sqlalchemy import String, Column, CHAR, DECIMAL, Float
from app.db.database import Base


class SnpCostResult(Base):
    """원가결과 스냅샷 - SAP CBO 원가 계산 최종 결과"""
    __tablename__ = "snp_cost_result"

    yyyymm = Column(CHAR(6), primary_key=True, comment="기준월")
    product_cd = Column(String(20), primary_key=True, comment="제품코드")
    proc_cd = Column(String(20), primary_key=True, comment="공정코드")
    ce_cd = Column(String(20), primary_key=True, comment="원가요소코드")
    cost_amt = Column(Float, comment="원가금액 (억원)")


class SnpAllocRate(Base):
    """배부율 스냅샷 - 공정별 배부율 산출 내역"""
    __tablename__ = "snp_alloc_rate"

    yyyymm = Column(CHAR(6), primary_key=True, comment="기준월")
    proc_cd = Column(String(20), primary_key=True, comment="공정코드")
    ce_cd = Column(String(20), primary_key=True, comment="원가요소코드")
    total_cost = Column(Float, comment="총비용 (억원)")
    total_base = Column(Float, comment="총배부기준량")
    base_unit = Column(String(10), comment="배부기준 단위 (만h, 개, kg)")
    alloc_rate = Column(Float, comment="배부율 (총비용/총배부기준량)")


class SnpAllocResult(Base):
    """배부결과 스냅샷 - 제품별 배부량 및 배부액"""
    __tablename__ = "snp_alloc_result"

    yyyymm = Column(CHAR(6), primary_key=True, comment="기준월")
    product_cd = Column(String(20), primary_key=True, comment="제품코드")
    proc_cd = Column(String(20), primary_key=True, comment="공정코드")
    ce_cd = Column(String(20), primary_key=True, comment="원가요소코드")
    alloc_qty = Column(Float, comment="제품별 배부량")
    alloc_amt = Column(Float, comment="배부액 (억원)")


class SnpBom(Base):
    """BOM 스냅샷 - 후공정 제품별 BOM (재료비 직접 집계용)"""
    __tablename__ = "snp_bom"

    yyyymm = Column(CHAR(6), primary_key=True, comment="기준월")
    product_cd = Column(String(20), primary_key=True, comment="제품코드")
    mat_cd = Column(String(20), primary_key=True, comment="자재코드")
    std_qty = Column(Float, comment="표준사용량")
    unit_price = Column(Float, comment="자재 단가")
    mat_amt = Column(Float, comment="재료비 (표준사용량 × 단가)")
