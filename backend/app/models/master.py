"""
Layer A: 마스터 데이터 모델
- 제품, 공정, 장비, 자재, 원가요소
"""

from sqlalchemy import String, Column, CHAR, DECIMAL
from app.db.database import Base


class MstProduct(Base):
    """제품 마스터"""
    __tablename__ = "mst_product"

    product_cd = Column(String(20), primary_key=True, comment="제품코드")
    product_grp = Column(String(20), nullable=False, comment="제품군")
    product_nm = Column(String(100), comment="제품명")
    proc_type = Column(String(10), comment="전공정/후공정 구분 (FE/BE)")
    use_yn = Column(CHAR(1), default="Y", comment="사용여부")


class MstProcess(Base):
    """공정 마스터"""
    __tablename__ = "mst_process"

    proc_cd = Column(String(20), primary_key=True, comment="공정코드")
    proc_nm = Column(String(100), comment="공정명")
    proc_type = Column(String(10), comment="전공정/후공정 (FE/BE)")
    proc_grp = Column(String(20), comment="공정군 (ETCH/DEP 등)")
    alloc_type = Column(String(20), comment="배부방식 (ALLOC/DIRECT)")
    alloc_base = Column(String(20), comment="배부기준 (ST/BOM/QTY)")


class MstEquipment(Base):
    """장비 마스터"""
    __tablename__ = "mst_equipment"

    equip_cd = Column(String(20), primary_key=True, comment="장비코드")
    equip_nm = Column(String(100), comment="장비명")
    proc_cd = Column(String(20), nullable=False, comment="소속 공정")
    fab_cd = Column(String(20), comment="FAB 코드")


class MstMaterial(Base):
    """자재 마스터"""
    __tablename__ = "mst_material"

    mat_cd = Column(String(20), primary_key=True, comment="자재코드")
    mat_nm = Column(String(100), comment="자재명")
    mat_type = Column(String(20), comment="자재유형 (SUBSTRATE/WIRE/GAS 등)")
    proc_type = Column(String(10), comment="사용공정유형 (FE/BE)")


class MstCostElement(Base):
    """원가요소 마스터"""
    __tablename__ = "mst_cost_element"

    ce_cd = Column(String(20), primary_key=True, comment="원가요소코드")
    ce_nm = Column(String(100), comment="원가요소명")
    ce_grp = Column(String(20), comment="원가요소그룹 (FIXED/VARIABLE/MIXED)")
