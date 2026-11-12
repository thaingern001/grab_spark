param([switch]$Preview)
$env:DEMO_SESSION_SECRET = 'local-demo-secret-for-grabspark-tests-2026'
if ($Preview) {
  $env:DATABASE_URL = 'postgresql+psycopg://grabspark:grabspark@127.0.0.1:5432/grabspark_a1_visual'
  .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
} else {
  .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
}
