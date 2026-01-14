import json
from pathlib import Path

report_path = Path(__file__).resolve().parent.parent / "lint-report.json"
if not report_path.exists():
    raise SystemExit("lint-report.json not found. Run eslint with JSON output first.")

data = json.loads(report_path.read_text(encoding="utf-8"))
entries = [entry for entry in data if entry.get("errorCount") or entry.get("warningCount")]

print(f"{len(entries)} files with issues")
for entry in entries:
    print(f"\n{entry['filePath']}")
    for msg in entry.get("messages", []):
        rule = msg.get("ruleId", "<no-rule>")
        message = msg.get("message", "<no-message>")
        line = msg.get("line", 0)
        col = msg.get("column", 0)
        print(f"  {rule}: {message} @{line}:{col}")
