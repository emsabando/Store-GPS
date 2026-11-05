<#
.SYNOPSIS
    Installs ("infuses") the ArchVizKit plugin into an existing Unreal Engine 5 project.

.DESCRIPTION
    - Copies Plugins\ArchVizKit into <Project>\Plugins\ArchVizKit
    - Enables the plugin in the .uproject
    - With -AddCppModule: adds a minimal empty C++ game module if the project is Blueprint-only,
      so the plugin can compile (skipped when a Source folder already exists)
    - Adds the Asset Manager rule that cooks the ArchViz project asset into packaged builds
    - Enables Custom Depth-Stencil for the unit outline highlight (skip with -SkipStencil)
    - With -SetDefaultGameMode: makes ArchVizGameMode the project's default GameMode
    - Copies the sample data, validator and docs to <Project>\ArchVizData
    Every file it changes is backed up first to <Project>\Saved\ArchVizKitBackup\<timestamp>.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\Install-ArchVizKit.ps1 -ProjectPath "C:\Projects\EchoBasin" -AddCppModule -DryRun
    Shows what would change without touching anything. Run again without -DryRun to apply.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectPath,
    [switch]$AddCppModule,
    [switch]$SetDefaultGameMode,
    [switch]$SkipStencil,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 can serialize arrays as {"value":[...],"Count":n}; this keeps .uproject arrays intact.
if ($PSVersionTable.PSVersion.Major -lt 6) { Remove-TypeData -TypeName System.Array -ErrorAction SilentlyContinue }

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Note([string]$Message) { Write-Host "    $Message" }
function Write-Warn([string]$Message) { Write-Host "    WARNING: $Message" -ForegroundColor Yellow }

# --- Locate the kit and the project -------------------------------------------------------
$KitRoot = Split-Path -Parent $PSScriptRoot
$PluginSource = Join-Path $KitRoot 'Plugins\ArchVizKit'
if (-not (Test-Path -LiteralPath (Join-Path $PluginSource 'ArchVizKit.uplugin'))) {
    throw "Cannot find ArchVizKit.uplugin under $PluginSource. Run this script from the ArchVizMasterTemplate\Tools folder."
}

if ($ProjectPath -like '*.uproject') { $ProjectPath = Split-Path -Parent $ProjectPath }
if (-not (Test-Path -LiteralPath $ProjectPath)) { throw "Project folder not found: $ProjectPath" }
$ProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path.TrimEnd('\')

$UProjects = @(Get-ChildItem -LiteralPath $ProjectPath -Filter '*.uproject' -File)
if ($UProjects.Count -ne 1) { throw "Expected exactly one .uproject in $ProjectPath, found $($UProjects.Count)." }
$UProjectPath = $UProjects[0].FullName
$ProjectName = [IO.Path]::GetFileNameWithoutExtension($UProjectPath)

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir = Join-Path $ProjectPath "Saved\ArchVizKitBackup\$Stamp"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# --- Helpers ----------------------------------------------------------------------------------
function Backup-File([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $Relative = $Path.Substring($ProjectPath.Length).TrimStart('\')
    $Target = Join-Path $BackupDir $Relative
    if ($DryRun) { Write-Note "[dry run] would back up $Relative"; return }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
    Copy-Item -LiteralPath $Path -Destination $Target -Force
}

function Write-TextFile([string]$Path, [string]$Text) {
    if ($DryRun) { Write-Note "[dry run] would write $($Path.Substring($ProjectPath.Length).TrimStart('\'))"; return }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
    [IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

# Appends an ini block unless Marker is already present. Keeps UTF-16 files UTF-16.
function Add-IniBlock([string]$Path, [string]$Marker, [string]$Block) {
    $Name = [IO.Path]::GetFileName($Path)
    $Exists = Test-Path -LiteralPath $Path
    $Encoding = $Utf8NoBom
    if ($Exists) {
        if ([IO.File]::ReadAllText($Path).Contains($Marker)) { Write-Note "${Name}: already configured"; return }
        $Bytes = [IO.File]::ReadAllBytes($Path)
        if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) { $Encoding = [Text.Encoding]::Unicode }
    }
    Backup-File $Path
    if ($DryRun) {
        Write-Note "[dry run] would append to ${Name}:"
        foreach ($Line in ($Block -split "`n")) { Write-Note "      $Line" }
        return
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
    $Text = "`r`n" + ($Block -replace "`r?`n", "`r`n") + "`r`n"
    [IO.File]::AppendAllText($Path, $Text, $Encoding)
    Write-Note "${Name}: updated"
}

# Copies a folder's files; existing files are kept unless Overwrite is set.
function Copy-Tree([string]$Source, [string]$Destination, [bool]$Overwrite) {
    foreach ($File in (Get-ChildItem -LiteralPath $Source -Recurse -File)) {
        $Relative = $File.FullName.Substring($Source.Length).TrimStart('\')
        $Target = Join-Path $Destination $Relative
        if ((Test-Path -LiteralPath $Target) -and -not $Overwrite) { Write-Note "kept your $Relative"; continue }
        if ($DryRun) { Write-Note "[dry run] would copy $Relative"; continue }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
        Copy-Item -LiteralPath $File.FullName -Destination $Target -Force
    }
}

function Test-HasProperty($Object, [string]$Name) { return @($Object.PSObject.Properties.Name) -contains $Name }

# --- Preflight -----------------------------------------------------------------------------------
Write-Step "Project: $ProjectName"
Write-Note $ProjectPath
if ($DryRun) { Write-Warn 'Dry run: nothing will be changed.' }

if (-not $DryRun -and (Get-Process -Name 'UnrealEditor' -ErrorAction SilentlyContinue)) {
    throw 'Close Unreal Editor first: it locks plugin and config files.'
}

$Project = Get-Content -LiteralPath $UProjectPath -Raw | ConvertFrom-Json
$EngineVersion = ''
if (Test-HasProperty $Project 'EngineAssociation') { $EngineVersion = [string]$Project.EngineAssociation }
if ($EngineVersion -match '^(\d+)\.(\d+)') {
    $Major = [int]$Matches[1]; $Minor = [int]$Matches[2]
    if ($Major -lt 5 -or ($Major -eq 5 -and $Minor -lt 4)) { Write-Warn "Project uses UE $EngineVersion; ArchVizKit targets UE 5.4 or later." }
    else { Write-Note "Engine: UE $EngineVersion" }
}
else { Write-Note "Engine association: '$EngineVersion' (source build or unset)" }

if ($ProjectPath -match '\\OneDrive\\') {
    Write-Warn 'Project is inside OneDrive. Pause syncing while building, or OneDrive may lock or upload Binaries, Intermediate and DerivedDataCache.'
}
if ($ProjectPath.Length -gt 120) {
    Write-Warn "Long project path ($($ProjectPath.Length) characters); plugin builds can hit the 260-character Windows path limit."
}

# --- 1. Plugin files -------------------------------------------------------------------------------
Write-Step 'Copying the ArchVizKit plugin'
$PluginDest = Join-Path $ProjectPath 'Plugins\ArchVizKit'
if (Test-Path -LiteralPath $PluginDest) {
    # Back up outside Plugins\ so Unreal never sees two copies of the plugin.
    $PluginBackup = Join-Path $BackupDir 'Plugins\ArchVizKit'
    if ($DryRun) { Write-Note "[dry run] would move the existing copy to $PluginBackup" }
    else {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PluginBackup) | Out-Null
        Move-Item -LiteralPath $PluginDest -Destination $PluginBackup
        Write-Note "previous copy moved to $PluginBackup"
    }
}
if ($DryRun) { Write-Note "[dry run] would copy the plugin to Plugins\ArchVizKit" }
else {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PluginDest) | Out-Null
    Copy-Item -LiteralPath $PluginSource -Destination $PluginDest -Recurse
    Remove-Item -LiteralPath (Join-Path $PluginDest 'Binaries'), (Join-Path $PluginDest 'Intermediate') -Recurse -Force -ErrorAction SilentlyContinue
    Write-Note 'copied to Plugins\ArchVizKit'
}

# --- 2. C++ game module (Blueprint-only projects) ---------------------------------------------------
$ModuleName = ''
if (Test-Path -LiteralPath (Join-Path $ProjectPath 'Source')) {
    Write-Note 'Source folder found: already a C++ project'
}
elseif (-not $AddCppModule) {
    Write-Warn 'No Source folder: Blueprint-only projects cannot compile the plugin. Re-run with -AddCppModule, or add any C++ class in the editor (Tools > New C++ Class).'
}
else {
    Write-Step 'Adding a minimal C++ game module (the project becomes a C++ project)'
    $ModuleName = $ProjectName -replace '[^A-Za-z0-9_]', ''
    if ($ModuleName -notmatch '^[A-Za-z_]') { $ModuleName = "Game$ModuleName" }
    $SourceDir = Join-Path $ProjectPath 'Source'

    $TargetTemplate = @'
using UnrealBuildTool;

public class __TARGET__ : TargetRules
{
	public __TARGET__(TargetInfo Target) : base(Target)
	{
		Type = TargetType.__TYPE__;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("__MODULE__");
	}
}
'@
    $BuildTemplate = @'
using UnrealBuildTool;

public class __MODULE__ : ModuleRules
{
	public __MODULE__(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
	}
}
'@
    $ModuleTemplate = @'
#include "Modules/ModuleManager.h"

IMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, __MODULE__, "__MODULE__");
'@
    Write-TextFile (Join-Path $SourceDir "$ModuleName.Target.cs") (($TargetTemplate -replace '__TARGET__', "${ModuleName}Target") -replace '__TYPE__', 'Game' -replace '__MODULE__', $ModuleName)
    Write-TextFile (Join-Path $SourceDir "${ModuleName}Editor.Target.cs") (($TargetTemplate -replace '__TARGET__', "${ModuleName}EditorTarget") -replace '__TYPE__', 'Editor' -replace '__MODULE__', $ModuleName)
    Write-TextFile (Join-Path $SourceDir "$ModuleName\$ModuleName.Build.cs") ($BuildTemplate -replace '__MODULE__', $ModuleName)
    Write-TextFile (Join-Path $SourceDir "$ModuleName\$ModuleName.cpp") ($ModuleTemplate -replace '__MODULE__', $ModuleName)
    Write-Note "module $ModuleName"
}

# --- 3. .uproject --------------------------------------------------------------------------------------
Write-Step "Enabling the plugin in $ProjectName.uproject"
$Changed = $false
if (-not (Test-HasProperty $Project 'Plugins')) { $Project | Add-Member -NotePropertyName 'Plugins' -NotePropertyValue @() }
$Entry = @($Project.Plugins) | Where-Object { $_.Name -eq 'ArchVizKit' } | Select-Object -First 1
if ($Entry) {
    if (-not ((Test-HasProperty $Entry 'Enabled') -and $Entry.Enabled)) {
        $Entry | Add-Member -NotePropertyName 'Enabled' -NotePropertyValue $true -Force
        $Changed = $true
    }
}
else {
    $Project.Plugins = @($Project.Plugins) + [pscustomobject]@{ Name = 'ArchVizKit'; Enabled = $true }
    $Changed = $true
}
if ($ModuleName) {
    if (-not (Test-HasProperty $Project 'Modules')) { $Project | Add-Member -NotePropertyName 'Modules' -NotePropertyValue @() }
    if (-not (@($Project.Modules) | Where-Object { $_.Name -eq $ModuleName })) {
        $Project.Modules = @($Project.Modules) + [pscustomobject]@{ Name = $ModuleName; Type = 'Runtime'; LoadingPhase = 'Default' }
        $Changed = $true
    }
}
if ($Changed) {
    Backup-File $UProjectPath
    Write-TextFile $UProjectPath (ConvertTo-Json -InputObject $Project -Depth 32)
    Write-Note 'updated'
}
else { Write-Note 'already enabled' }

# --- 4. Config ---------------------------------------------------------------------------------------------
Write-Step 'Updating config'
$GameIni = Join-Path $ProjectPath 'Config\DefaultGame.ini'
$EngineIni = Join-Path $ProjectPath 'Config\DefaultEngine.ini'

Add-IniBlock $GameIni 'PrimaryAssetType="ArchVizProject"' @'
[/Script/Engine.AssetManagerSettings]
+PrimaryAssetTypesToScan=(PrimaryAssetType="ArchVizProject",AssetBaseClass="/Script/ArchVizKit.ArchVizProjectAsset",bHasBlueprintClasses=False,bIsEditorOnly=False,Directories=((Path="/Game/ArchViz")),Rules=(CookRule=AlwaysCook))
'@

if (-not $SkipStencil) {
    $EngineText = ''
    if (Test-Path -LiteralPath $EngineIni) { $EngineText = [IO.File]::ReadAllText($EngineIni) }
    if (($EngineText -match 'r\.CustomDepth=(\d)') -and ($Matches[1] -ne '3')) {
        Write-Warn "DefaultEngine.ini already sets r.CustomDepth=$($Matches[1]). For the unit outline, set Project Settings > Rendering > Custom Depth-Stencil Pass to 'Enabled with Stencil'."
    }
    else {
        Add-IniBlock $EngineIni 'r.CustomDepth=3' "[/Script/Engine.RendererSettings]`nr.CustomDepth=3"
    }
}

if ($SetDefaultGameMode) {
    Add-IniBlock $EngineIni 'GlobalDefaultGameMode=/Script/ArchVizKit.ArchVizGameMode' "[/Script/EngineSettings.GameMapsSettings]`nGlobalDefaultGameMode=/Script/ArchVizKit.ArchVizGameMode"
}

# --- 5. Data and docs ----------------------------------------------------------------------------------------
Write-Step 'Copying sample data and docs to ArchVizData'
$DataDest = Join-Path $ProjectPath 'ArchVizData'
Copy-Tree (Join-Path $KitRoot 'Data') (Join-Path $DataDest 'Data') $false
Copy-Tree (Join-Path $KitRoot 'docs') (Join-Path $DataDest 'docs') $true
foreach ($Single in @('README.md', 'Tools\validate_inventory.py')) {
    $Source = Join-Path $KitRoot $Single
    $Target = Join-Path $DataDest (Split-Path -Leaf $Single)
    if ($DryRun) { Write-Note "[dry run] would copy $Single" }
    else {
        New-Item -ItemType Directory -Force -Path $DataDest | Out-Null
        Copy-Item -LiteralPath $Source -Destination $Target -Force
    }
}

# --- Done -------------------------------------------------------------------------------------------------------
Write-Host ''
if ($DryRun) {
    Write-Step 'Dry run complete. Re-run without -DryRun to apply.'
    return
}
Write-Step 'Done. Next:'
Write-Note "1. Right-click $ProjectName.uproject > Generate Visual Studio project files, then build"
Write-Note '   "Development Editor" in Visual Studio 2022 (workload: Game development with C++).'
Write-Note '   Or double-click the .uproject and answer Yes when asked to rebuild modules.'
Write-Note '2. In the editor, check Edit > Plugins > ArchViz Kit is enabled.'
Write-Note '3. Follow ArchVizData\docs\PROJECT_SETUP.md: create the project asset, import the CSVs,'
Write-Note '   set Project Settings > Plugins > ArchViz Kit, then place shots, POIs and the environment.'
Write-Note "Backups of everything changed: $BackupDir"
