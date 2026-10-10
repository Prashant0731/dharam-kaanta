from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class EntryBase(BaseModel):
    sno: int
    vehicle: Optional[str] = None
    tare: Optional[str] = None
    gross: Optional[str] = None
    vehiclePhoto: Optional[str] = None
    grossPhoto: Optional[str] = None

class EntryCreate(EntryBase):
    pass

class EntryUpdate(BaseModel):
    vehicle: Optional[str] = None
    tare: Optional[str] = None
    gross: Optional[str] = None
    vehiclePhoto: Optional[str] = None
    grossPhoto: Optional[str] = None
    saved: Optional[bool] = None

class EntryResponse(EntryBase):
    id: UUID
    net: float
    money: float
    saved: bool
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class StatsResponse(BaseModel):
    totalEntries: int
    savedEntries: int
    todayEntries: int
    totalWeight: float
    totalRevenue: float

class ExportRequest(BaseModel):
    format: str = Field(..., pattern="^(excel|pdf|word)$")
    dateFrom: Optional[str] = None
    dateTo: Optional[str] = None
    vehicleFilter: Optional[str] = None