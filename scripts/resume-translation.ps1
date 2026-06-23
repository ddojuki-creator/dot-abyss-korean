$root = Split-Path -Parent $PSScriptRoot

function Test-Worker([string] $pattern) {
    return [bool](Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq 'powershell.exe' -and $_.CommandLine -like $pattern
    })
}

if (-not (Test-Path (Join-Path $root '.cache\review-context.done.json')) -and
    -not (Test-Worker '*run-context-review.ps1*')) {
    Start-Process powershell.exe -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        (Join-Path $root 'scripts\run-context-review.ps1')
    ) -WorkingDirectory $root -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $root '.cache\review-context.log') `
      -RedirectStandardError (Join-Path $root '.cache\review-context.error.log')
}

if (-not (Test-Path (Join-Path $root '.cache\runtime-outgame.done.json')) -and
    -not (Test-Worker '*run-runtime-outgame.ps1*')) {
    Start-Process powershell.exe -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        (Join-Path $root 'scripts\run-runtime-outgame.ps1')
    ) -WorkingDirectory $root -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $root '.cache\runtime-outgame.log') `
      -RedirectStandardError (Join-Path $root '.cache\runtime-outgame.error.log')
}
