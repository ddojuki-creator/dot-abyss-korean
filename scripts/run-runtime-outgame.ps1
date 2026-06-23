$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$node = 'C:\Users\tl300\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$reviewDone = Join-Path $root '.cache\review-context.done.json'
$doneFile = Join-Path $root '.cache\runtime-outgame.done.json'
$testRepo = 'C:\Users\tl300\Documents\Codex\2026-06-17\new-chat\work\dot-abyss-korean-test'

Set-Location $root
$env:OPENAI_API_KEY = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
$env:OPENAI_MODEL = 'gpt-4.1-mini'

try {
    while ($true) {
        if (Test-Path $reviewDone) {
            $review = Get-Content $reviewDone -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($review.status -eq 'failed') { throw "Context review failed: $($review.error)" }
            if ($review.status -eq 'complete') { break }
        }
        Start-Sleep -Seconds 10
    }

    & $node scripts\translate-ko.mjs --file translations/outgame/ko_KR.json --scope common
    if ($LASTEXITCODE -ne 0) { throw "Runtime UI translation failed with exit code $LASTEXITCODE" }
    & $node scripts\normalize-terminology.mjs
    & $node scripts\update-manifest.mjs
    & $node scripts\validate-translations.mjs
    if ($LASTEXITCODE -ne 0) { throw "Validation failed with exit code $LASTEXITCODE" }

    Copy-Item -Path (Join-Path $root 'translations\*') -Destination (Join-Path $testRepo 'translations') -Recurse -Force
    git -c "safe.directory=$testRepo" -C $testRepo add translations
    git -c "safe.directory=$testRepo" -C $testRepo commit -m 'Add reviewed runtime UI translations'
    if ($LASTEXITCODE -ne 0) { throw "Test commit failed with exit code $LASTEXITCODE" }
    git -c "safe.directory=$testRepo" -C $testRepo push origin test
    if ($LASTEXITCODE -ne 0) { throw "Test push failed with exit code $LASTEXITCODE" }

    @{ status = 'complete'; completedAt = (Get-Date).ToString('o') } |
        ConvertTo-Json | Set-Content -Path $doneFile -Encoding UTF8
} catch {
    @{ status = 'failed'; completedAt = (Get-Date).ToString('o'); error = $_.Exception.Message } |
        ConvertTo-Json | Set-Content -Path $doneFile -Encoding UTF8
    throw
}
