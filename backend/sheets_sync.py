"""
Google Sheets Sync Service for Dharam Kaanta
Syncs weighbridge entries to Google Sheets
"""
import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# Google Sheets API scopes
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# Column headers for the sheet
SHEET_HEADERS = [
    'S.No',
    'Date',
    'Tyre Type',
    'Vehicle No.',
    'Tare (kg)',
    'Gross (kg)',
    'Net (kg)',
    'Amount',
    'Vehicle Photo',
    'Gross Photo',
    'Status',
    'Created At'
]


class GoogleSheetsSync:
    """Handles syncing entries to Google Sheets"""
    
    def __init__(self):
        self.credentials = None
        self.service = None
        self.spreadsheet_id = None
        self.sheet_name = 'Entries'
        self._initialize()
    
    def _initialize(self):
        """Initialize Google Sheets service"""
        try:
            # Try to get credentials from environment variable
            creds_json = os.getenv('GOOGLE_SHEETS_CREDENTIALS')
            self.spreadsheet_id = os.getenv('GOOGLE_SHEETS_SPREADSHEET_ID')
            self.sheet_name = os.getenv('GOOGLE_SHEETS_SHEET_NAME', 'Entries')
            
            if not creds_json:
                logger.warning("GOOGLE_SHEETS_CREDENTIALS not set. Google Sheets sync disabled.")
                return
            
            if not self.spreadsheet_id:
                logger.warning("GOOGLE_SHEETS_SPREADSHEET_ID not set. Google Sheets sync disabled.")
                return
            
            # Parse credentials
            creds_info = json.loads(creds_json)
            self.credentials = service_account.Credentials.from_service_account_info(
                creds_info, scopes=SCOPES
            )
            
            # Build service
            self.service = build('sheets', 'v4', credentials=self.credentials)
            logger.info("Google Sheets sync initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets sync: {e}")
            self.service = None
    
    def is_enabled(self) -> bool:
        """Check if sync is properly configured"""
        return self.service is not None and self.spreadsheet_id is not None
    
    def _get_sheet_range(self) -> str:
        """Get the A1 notation range for the sheet"""
        return f"'{self.sheet_name}'"
    
    def _ensure_sheet_exists(self) -> bool:
        """Ensure the sheet exists and has headers"""
        try:
            # Try to get the sheet
            result = self.service.spreadsheets().get(
                spreadsheetId=self.spreadsheet_id,
                ranges=[self.sheet_name],
                includeGridData=False
            ).execute()
            
            sheets = result.get('sheets', [])
            if not sheets:
                # Create the sheet
                return self._create_sheet_with_headers()
            
            return True
            
        except HttpError as e:
            if e.resp.status == 404:
                return self._create_sheet_with_headers()
            logger.error(f"Error checking sheet: {e}")
            return False
    
    def _create_sheet_with_headers(self) -> bool:
        """Create sheet with headers"""
        try:
            # Add sheet
            body = {
                'requests': [{
                    'addSheet': {
                        'properties': {
                            'title': self.sheet_name,
                            'gridProperties': {
                                'frozenRowCount': 1
                            }
                        }
                    }
                }]
            }
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body=body
            ).execute()
            
            # Add headers
            self._write_headers()
            return True
            
        except HttpError as e:
            logger.error(f"Error creating sheet: {e}")
            return False
    
    def _write_headers(self) -> bool:
        """Write header row"""
        try:
            body = {
                'values': [SHEET_HEADERS]
            }
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{self.sheet_name}'!A1",
                valueInputOption='RAW',
                body=body
            ).execute()
            return True
        except HttpError as e:
            logger.error(f"Error writing headers: {e}")
            return False
    
    def _entry_to_row(self, entry: Dict[str, Any], index: int) -> List[Any]:
        """Convert entry dict to sheet row"""
        return [
            index + 1,  # S.No
            entry.get('createdAt', '').split('T')[0] if entry.get('createdAt') else '',  # Date
            entry.get('tyreType') or entry.get('tyre_type') or 'Radial',  # Tyre Type
            entry.get('vehicle', ''),  # Vehicle No.
            entry.get('tare', ''),  # Tare (kg)
            entry.get('gross', ''),  # Gross (kg)
            entry.get('net', 0) if entry.get('net') else '',  # Net (kg)
            round(entry.get('money', 0), 2) if entry.get('money') else '',  # Amount
            'Yes' if entry.get('vehiclePhoto') else 'No',  # Vehicle Photo
            'Yes' if entry.get('grossPhoto') else 'No',  # Gross Photo
            'Saved' if entry.get('saved') else 'Draft',  # Status
            entry.get('createdAt', '')  # Created At
        ]
    
    def sync_all(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Sync all entries to Google Sheets
        Returns: {'success': bool, 'synced': int, 'errors': List[str]}
        """
        if not self.is_enabled():
            return {'success': False, 'synced': 0, 'errors': ['Google Sheets sync not configured']}
        
        try:
            # Ensure sheet exists with headers
            if not self._ensure_sheet_exists():
                return {'success': False, 'synced': 0, 'errors': ['Failed to ensure sheet exists']}
            
            # Prepare all rows
            rows = []
            for idx, entry in enumerate(entries):
                rows.append(self._entry_to_row(entry, idx))
            
            if not rows:
                return {'success': True, 'synced': 0, 'errors': []}
            
            # Clear existing data (keep header)
            self.service.spreadsheets().values().clear(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{self.sheet_name}'!A2:Z",
            ).execute()
            
            # Write all rows
            body = {'values': rows}
            result = self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{self.sheet_name}'!A2",
                valueInputOption='RAW',
                body=body
            ).execute()
            
            updated_rows = result.get('updatedRows', 0)
            logger.info(f"Synced {updated_rows} rows to Google Sheets")
            
            return {'success': True, 'synced': updated_rows, 'errors': []}
            
        except HttpError as e:
            logger.error(f"Google Sheets API error: {e}")
            return {'success': False, 'synced': 0, 'errors': [str(e)]}
        except Exception as e:
            logger.error(f"Sync error: {e}")
            return {'success': False, 'synced': 0, 'errors': [str(e)]}
    
    def append_entry(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """Append a single entry to the sheet"""
        if not self.is_enabled():
            return {'success': False, 'error': 'Google Sheets sync not configured'}
        
        try:
            if not self._ensure_sheet_exists():
                return {'success': False, 'error': 'Failed to ensure sheet exists'}
            
            # Get current row count
            result = self.service.spreadsheets().values().get(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{self.sheet_name}'!A:A"
            ).execute()
            
            values = result.get('values', [])
            next_row = len(values) + 1
            
            # Append single row
            row = self._entry_to_row(entry, next_row - 1)
            body = {'values': [row]}
            
            self.service.spreadsheets().values().append(
                spreadsheetId=self.spreadsheet_id,
                range=f"'{self.sheet_name}'!A{next_row}",
                valueInputOption='RAW',
                insertDataOption='INSERT_ROWS',
                body=body
            ).execute()
            
            logger.info(f"Appended entry to row {next_row}")
            return {'success': True, 'row': next_row}
            
        except HttpError as e:
            logger.error(f"Error appending entry: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Error appending entry: {e}")
            return {'success': False, 'error': str(e)}


# Global instance
_sheets_sync: Optional[GoogleSheetsSync] = None


def get_sheets_sync() -> GoogleSheetsSync:
    """Get or create global sheets sync instance"""
    global _sheets_sync
    if _sheets_sync is None:
        _sheets_sync = GoogleSheetsSync()
    return _sheets_sync


def init_sheets_sync():
    """Initialize sheets sync on startup"""
    global _sheets_sync
    _sheets_sync = GoogleSheetsSync()
    return _sheets_sync