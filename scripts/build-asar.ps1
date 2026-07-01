param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$Output = (Join-Path $ProjectRoot "dist\win-unpacked\resources\app.asar")
)

$ErrorActionPreference = "Stop"

function Write-UInt32LE {
  param(
    [System.IO.Stream]$Stream,
    [uint32]$Value
  )

  $bytes = [System.BitConverter]::GetBytes($Value)
  $Stream.Write($bytes, 0, $bytes.Length)
}

function Add-AsarFile {
  param(
    [System.Collections.Specialized.OrderedDictionary]$Root,
    [string]$RelativePath,
    [long]$Size,
    [long]$Offset
  )

  $parts = $RelativePath -split "/"
  $files = $Root["files"]

  for ($i = 0; $i -lt ($parts.Length - 1); $i++) {
    $part = $parts[$i]
    if (-not $files.Contains($part)) {
      $files[$part] = [ordered]@{ files = [ordered]@{} }
    }
    $files = $files[$part]["files"]
  }

  $files[$parts[-1]] = [ordered]@{
    size = $Size
    offset = [string]$Offset
  }
}

function Get-RelativeArchivePath {
  param(
    [string]$Root,
    [string]$FullName
  )

  return $FullName.Substring($Root.Length).TrimStart("\", "/") -replace "\\", "/"
}

$includeRoots = @(
  "README-desktop.md",
  "electron",
  "index.html",
  "package.json",
  "scripts",
  "styles"
)

$entries = New-Object System.Collections.Generic.List[object]

foreach ($include in $includeRoots) {
  $path = Join-Path $ProjectRoot $include
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    $item = Get-Item -LiteralPath $path
    $entries.Add([pscustomobject]@{
      FullName = $item.FullName
      RelativePath = (Get-RelativeArchivePath $ProjectRoot $item.FullName)
      Length = $item.Length
    })
    continue
  }

  if (Test-Path -LiteralPath $path -PathType Container) {
    Get-ChildItem -LiteralPath $path -Recurse -File |
      Sort-Object FullName |
      ForEach-Object {
        $entries.Add([pscustomobject]@{
          FullName = $_.FullName
          RelativePath = (Get-RelativeArchivePath $ProjectRoot $_.FullName)
          Length = $_.Length
        })
      }
  }
}

$header = [ordered]@{ files = [ordered]@{} }
$offset = [int64]0

foreach ($entry in $entries) {
  Add-AsarFile $header $entry.RelativePath $entry.Length $offset
  $offset += $entry.Length
}

$json = $header | ConvertTo-Json -Compress -Depth 32
$jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$paddedJsonLength = [int]([Math]::Ceiling($jsonBytes.Length / 4.0) * 4)
$headerPayloadLength = 4 + $paddedJsonLength
$headerPickleLength = 4 + $headerPayloadLength

$outputDirectory = Split-Path -Parent $Output
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$stream = [System.IO.File]::Open($Output, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
try {
  Write-UInt32LE $stream 4
  Write-UInt32LE $stream $headerPickleLength
  Write-UInt32LE $stream $headerPayloadLength
  Write-UInt32LE $stream $jsonBytes.Length
  $stream.Write($jsonBytes, 0, $jsonBytes.Length)

  $paddingLength = $paddedJsonLength - $jsonBytes.Length
  if ($paddingLength -gt 0) {
    $stream.Write((New-Object byte[] $paddingLength), 0, $paddingLength)
  }

  foreach ($entry in $entries) {
    $inputStream = [System.IO.File]::OpenRead($entry.FullName)
    try {
      $inputStream.CopyTo($stream)
    }
    finally {
      $inputStream.Dispose()
    }
  }
}
finally {
  $stream.Dispose()
}

Get-Item -LiteralPath $Output |
  Select-Object FullName, Length, LastWriteTime
