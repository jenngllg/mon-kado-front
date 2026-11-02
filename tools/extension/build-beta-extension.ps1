param([string] $OutputPath)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sourceRoot = Join-Path $repositoryRoot 'extension'
$manifest = Get-Content -LiteralPath (Join-Path $sourceRoot 'manifest.json') -Raw | ConvertFrom-Json
$productionOrigin = 'https://www.monkado.fr/*'
if (($manifest.host_permissions -join ',') -ne $productionOrigin -or ($manifest.content_scripts.matches -join ',') -ne $productionOrigin) {
    throw 'The beta extension must target only the public MonKado site.'
}
$files = @('manifest.json', 'popup.html', 'popup.css', 'popup.js', 'suggestionFlow.js', 'extract.js', 'imageSelection.js', 'session-bridge.js', 'icon.png', 'README.md', 'INSTALLATION.md')
foreach ($name in $files) {
    if (!(Test-Path -LiteralPath (Join-Path $sourceRoot $name) -PathType Leaf)) { throw "Missing extension file: $name" }
}
if (!$OutputPath) { $OutputPath = Join-Path $repositoryRoot ".local/MonKado-extension-beta-$($manifest.version).zip" }
$archivePath = [IO.Path]::GetFullPath($OutputPath)
$archiveDirectory = Split-Path $archivePath -Parent
New-Item -ItemType Directory -Path $archiveDirectory -Force | Out-Null
$temporaryPath = Join-Path $archiveDirectory ('.extension-' + [guid]::NewGuid().ToString('N') + '.zip')

Add-Type -AssemblyName System.IO.Compression
$zip = [IO.Compression.ZipFile]::Open($temporaryPath, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($name in $files) {
        $entry = $zip.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
        $stream = $entry.Open()
        try { $stream.Write([IO.File]::ReadAllBytes((Join-Path $sourceRoot $name))) } finally { $stream.Dispose() }
    }
} finally { $zip.Dispose() }

$zip = [IO.Compression.ZipFile]::OpenRead($temporaryPath)
try {
    if ($zip.Entries.Count -ne $files.Count) { throw 'The extension archive has an unexpected file count.' }
    foreach ($name in $files) {
        $stream = $zip.GetEntry($name).Open()
        try { $actual = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)) } finally { $stream.Dispose() }
        $expected = (Get-FileHash -LiteralPath (Join-Path $sourceRoot $name) -Algorithm SHA256).Hash
        if ($actual -ne $expected) { throw "Extension archive verification failed: $name" }
    }
} finally { $zip.Dispose() }

if (Test-Path -LiteralPath $archivePath) {
    $backupPath = $archivePath + '.' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ') + '.previous'
    Copy-Item -LiteralPath $archivePath -Destination $backupPath
    if ((Get-FileHash -LiteralPath $backupPath).Hash -ne (Get-FileHash -LiteralPath $archivePath).Hash) { throw 'The previous extension archive backup could not be verified.' }
}
[IO.File]::Move($temporaryPath, $archivePath, $true)
[pscustomobject]@{ Archive = $archivePath; Version = $manifest.version; Files = $files.Count; SHA256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash }
