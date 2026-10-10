from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime, date
import uuid

from app.core.database import get_db
from app.models.entry import WeighbridgeEntry
from app.schemas.entry import EntryCreate, EntryUpdate, EntryResponse, StatsResponse

router = APIRouter()

@router.get("/entries", response_model=List[EntryResponse])
def get_entries(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(WeighbridgeEntry)
    
    if search:
        query = query.filter(WeighbridgeEntry.vehicle.ilike(f"%{search}%"))
    
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            query = query.filter(WeighbridgeEntry.created_at >= dt)
        except ValueError:
            pass
    
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.filter(WeighbridgeEntry.created_at <= dt)
        except ValueError:
            pass
    
    entries = query.order_by(WeighbridgeEntry.created_at.desc()).offset(skip).limit(limit).all()
    return entries

@router.get("/entries/{entry_id}", response_model=EntryResponse)
def get_entry(entry_id: uuid.UUID, db: Session = Depends(get_db)):
    entry = db.query(WeighbridgeEntry).filter(WeighbridgeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry

@router.post("/entries", response_model=EntryResponse)
def create_entry(entry: EntryCreate, db: Session = Depends(get_db)):
    # Calculate net and money
    tare = float(entry.tare) if entry.tare else 0
    gross = float(entry.gross) if entry.gross else 0
    net = gross - tare if (tare or gross) else 0
    money = round(net / 5, 2) if net else 0
    
    db_entry = WeighbridgeEntry(
        **entry.model_dump(),
        net=net,
        money=money,
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.put("/entries/{entry_id}", response_model=EntryResponse)
def update_entry(entry_id: uuid.UUID, entry: EntryUpdate, db: Session = Depends(get_db)):
    db_entry = db.query(WeighbridgeEntry).filter(WeighbridgeEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    update_data = entry.model_dump(exclude_unset=True)
    
    # Recalculate net and money if tare or gross changed
    if 'tare' in update_data or 'gross' in update_data:
        tare = float(update_data.get('tare', db_entry.tare)) if update_data.get('tare') or db_entry.tare else 0
        gross = float(update_data.get('gross', db_entry.gross)) if update_data.get('gross') or db_entry.gross else 0
        net = gross - tare if (tare or gross) else 0
        money = round(net / 5, 2) if net else 0
        update_data['net'] = net
        update_data['money'] = money
    
    for field, value in update_data.items():
        setattr(db_entry, field, value)
    
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: uuid.UUID, db: Session = Depends(get_db)):
    db_entry = db.query(WeighbridgeEntry).filter(WeighbridgeEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(db_entry)
    db.commit()
    return {"message": "Entry deleted"}

@router.post("/entries/bulk", response_model=List[EntryResponse])
def bulk_create_entries(entries: List[EntryCreate], db: Session = Depends(get_db)):
    created = []
    for entry in entries:
        tare = float(entry.tare) if entry.tare else 0
        gross = float(entry.gross) if entry.gross else 0
        net = gross - tare if (tare or gross) else 0
        money = round(net / 5, 2) if net else 0
        
        db_entry = WeighbridgeEntry(
            **entry.model_dump(),
            net=net,
            money=money,
        )
        db.add(db_entry)
        created.append(db_entry)
    
    db.commit()
    for e in created:
        db.refresh(e)
    return created

@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(WeighbridgeEntry.id)).scalar() or 0
    saved = db.query(func.count(WeighbridgeEntry.id)).filter(WeighbridgeEntry.saved == True).scalar() or 0
    today = db.query(func.count(WeighbridgeEntry.id)).filter(
        func.date(WeighbridgeEntry.created_at) == date.today()
    ).scalar() or 0
    total_weight = db.query(func.coalesce(func.sum(WeighbridgeEntry.net), 0)).scalar() or 0
    total_revenue = db.query(func.coalesce(func.sum(WeighbridgeEntry.money), 0)).scalar() or 0
    
    return StatsResponse(
        totalEntries=total,
        savedEntries=saved,
        todayEntries=today,
        totalWeight=float(total_weight),
        totalRevenue=float(total_revenue),
    )