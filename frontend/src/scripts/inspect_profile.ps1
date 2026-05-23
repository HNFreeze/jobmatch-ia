$f = Join-Path $PSScriptRoot '..\pages\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
Write-Output "Total: $($lines.Length)"
for ($i=1330; $i -le 1345; $i++) {
    Write-Output ("$i`: " + $lines[$i-1])
}
