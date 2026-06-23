$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = 'C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$doneFile = Join-Path $root '.cache\review-context.done.json'

Set-Location $root
$env:OPENAI_API_KEY = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
$env:OPENAI_REVIEW_MODEL = 'gpt-5.5'
$env:OPENAI_REVIEW_SCREEN_MODEL = 'gpt-5.4-mini'

try {
    & $node scripts\review-context.mjs
    if ($LASTEXITCODE -ne 0) { throw "Context review failed with exit code $LASTEXITCODE" }
    & $node scripts\normalize-terminology.mjs
    & $node scripts\update-manifest.mjs
    & $node scripts\validate-translations.mjs
    if ($LASTEXITCODE -ne 0) { throw "Validation failed with exit code $LASTEXITCODE" }
    @{ status = 'complete'; completedAt = (Get-Date).ToString('o') } |
        ConvertTo-Json | Set-Content -Path $doneFile -Encoding UTF8
} catch {
    @{ status = 'failed'; completedAt = (Get-Date).ToString('o'); error = $_.Exception.Message } |
        ConvertTo-Json | Set-Content -Path $doneFile -Encoding UTF8
    throw
}
