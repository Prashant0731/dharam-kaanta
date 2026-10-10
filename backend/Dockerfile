FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir flask flask-cors openpyxl fpdf2 python-docx

COPY flask_app.py .
COPY dharam_kaanta.db .

EXPOSE 8000

CMD ["python", "flask_app.py"]