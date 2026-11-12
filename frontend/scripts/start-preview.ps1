$env:GRABSPARK_API_BASE_URL = 'http://127.0.0.1:8001'
$env:GRABSPARK_DEMO_RESET_ENABLED = '1'
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001
