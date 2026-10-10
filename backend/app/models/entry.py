from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base

class WeighbridgeEntry(Base):
    __tablename__ = "weighbridge_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sno = Column(Integer, nullable=False)
    vehicle = Column(String(50), nullable=True, index=True)
    tare = Column(String(20), nullable=True)
    gross = Column(String(20), nullable=True)
    net = Column(Float, default=0)
    money = Column(Float, default=0)
    vehicle_photo = Column(Text, nullable=True)  # Base64 encoded
    gross_photo = Column(Text, nullable=True)    # Base64 encoded
    saved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "sno": self.sno,
            "vehicle": self.vehicle,
            "tare": self.tare,
            "gross": self.gross,
            "net": self.net,
            "money": self.money,
            "vehiclePhoto": self.vehicle_photo,
            "grossPhoto": self.gross_photo,
            "saved": self.saved,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }