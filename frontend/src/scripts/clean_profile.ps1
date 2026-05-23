$f = 'c:\Users\SERGI\Desktop\01_TRABAJO\TFM Desarrollo IA\jobmatch-ia\frontend\src\pages\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Delete lines 1335 to 1498 (0-indexed: 1334 to 1497)
$startDelete = 1334  # 0-indexed
$endDelete   = 1497  # 0-indexed (inclusive)
$kept = @()
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($i -lt $startDelete -or $i -gt $endDelete) {
        $kept += $lines[$i]
    }
}
[System.IO.File]::WriteAllLines($f, $kept, [System.Text.Encoding]::UTF8)
Write-Output "Done. Removed $($endDelete - $startDelete + 1) lines. New total: $($kept.Length)"
