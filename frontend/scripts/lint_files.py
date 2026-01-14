import json
from pathlib import Path

report_path = Path(__file__).resolve().parent.parent / "lint-report.json"
data = json.loads(report_path.read_text(encoding="utf-8"))
files = [entry["filePath"] for entry in data if entry.get("errorCount") or entry.get("warningCount")]
for path in files:
    print(path)
