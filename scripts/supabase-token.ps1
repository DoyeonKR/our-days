# Supabase 개인 액세스 토큰(PAT)을 이 PC 의 사용자 환경 변수 SUPABASE_ACCESS_TOKEN 에 넣는다. [2026-09-27]
# Claude Code 의 Supabase MCP(.mcp.json)와 scripts/supa.mjs 가 이 변수를 읽는다(README §7 'Claude 직접 접근').
#
#   넣기 · 바꾸기: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/supabase-token.ps1
#   지우기:        powershell -NoProfile -ExecutionPolicy Bypass -File scripts/supabase-token.ps1 -Remove
#
# 토큰은 가려진 칸으로만 받고 어디에도 출력하지 않는다. 채팅 · 레포 · 커밋에 붙여 넣지 않는다.
# ⚠ 이 파일은 UTF-8(BOM)이다 — Windows PowerShell 5.1 은 BOM 이 없으면 한글을 깨뜨려 읽는다.
param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$name = 'SUPABASE_ACCESS_TOKEN'
$ref = 'tqegatiuembcvphxmujl'

if ($Remove) {
  [Environment]::SetEnvironmentVariable($name, $null, 'User')
  Write-Host '지웠어요. 토큰 자체는 대시보드 Account > Access Tokens 에서 폐기하세요.'
  exit 0
}

Write-Host '1) https://supabase.com/dashboard/account/tokens 에서 새 토큰을 만든다(이름 예: claude-code).'
Write-Host '2) 아래 칸에 붙여 넣고 Enter — 화면에는 안 보여요.'
$secure = Read-Host -AsSecureString '토큰'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if (-not $token) { Write-Host '비어 있어요. 다시 실행해 주세요.'; exit 1 }

# 저장하기 전에 이 프로젝트에 실제로 닿는지 본다 — 틀린 토큰을 저장해 두면 MCP 가 조용히 안 붙는다.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
try {
  $p = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ref" -Headers @{ Authorization = "Bearer $token" }
} catch {
  Write-Host "이 토큰으로 프로젝트($ref)를 못 읽었어요 — 저장하지 않았어요. $($_.Exception.Message)"
  exit 1
}
[Environment]::SetEnvironmentVariable($name, $token, 'User')
Write-Host "저장했어요 — '$($p.name)' ($($p.status), $($p.region))."
Write-Host 'Claude 앱을 완전히 종료(작업 표시줄 오른쪽 트레이의 Claude 아이콘 > 종료)했다가 다시 켜면 Supabase MCP 가 붙어요.'
