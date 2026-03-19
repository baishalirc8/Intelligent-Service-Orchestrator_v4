#Requires -Version 5.1
<#
.SYNOPSIS
    HOLOCRON AI Probe Agent for Windows
.DESCRIPTION
    Lightweight probe agent that enrolls with HOLOCRON AI, sends heartbeats,
    and collects system metrics from Windows machines.
.PARAMETER Token
    The site token generated from HOLOCRON AI console
.PARAMETER ApiUrl
    The HOLOCRON AI API base URL
.PARAMETER Command
    Action to perform: Start, Install, Uninstall, Status, Test
.EXAMPLE
    .\holocron-probe.ps1 -Token "hcn_abc123" -ApiUrl "https://your-instance.com" -Command Start
.EXAMPLE
    .\holocron-probe.ps1 -Token "hcn_abc123" -ApiUrl "https://your-instance.com" -Command Install
#>

param(
    [string]$Token = $env:HOLOCRON_TOKEN,
    [string]$ApiUrl = $env:HOLOCRON_API,
    [string]$HmacSecret = $env:HOLOCRON_HMAC_SECRET,
    [ValidateSet("Start", "Install", "Uninstall", "Status", "Test", "Help")]
    [string]$Command = "Start",
    [string[]]$ManagedServers = @()
)

$ProbeVersion = "1.2.3"
$HeartbeatInterval = 60
$ServiceName = "HolocronProbe"
$InstallPath = "$env:ProgramData\HolocronProbe"
$LogPath = "$InstallPath\probe.log"

function Write-Banner {
    Write-Host ""
    Write-Host "  +==============================================+" -ForegroundColor Cyan
    Write-Host "  |          HOLOCRON AI Probe Agent              |" -ForegroundColor Cyan
    Write-Host "  |            Windows v$ProbeVersion                   |" -ForegroundColor Cyan
    Write-Host "  +==============================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "SUCCESS" { "Green" }
        "ERROR"   { "Red" }
        "WARN"    { "Yellow" }
        default   { "Cyan" }
    }
    Write-Host "[$timestamp] " -NoNewline -ForegroundColor DarkGray
    Write-Host $Message -ForegroundColor $color

    if (Test-Path (Split-Path $LogPath -Parent) -ErrorAction SilentlyContinue) {
        "[$timestamp] [$Level] $Message" | Out-File -Append -FilePath $LogPath -ErrorAction SilentlyContinue
    }
}

function Get-SystemHostname {
    try { return [System.Net.Dns]::GetHostName() }
    catch { return $env:COMPUTERNAME }
}

function Get-PrimaryIP {
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -Type Unicast |
            Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } |
            Sort-Object -Property InterfaceIndex |
            Select-Object -First 1).IPAddress
        if ($ip) { return $ip }
    } catch {}

    try {
        $ip = (Test-Connection -ComputerName (hostname) -Count 1 -ErrorAction SilentlyContinue).IPV4Address.IPAddressToString
        if ($ip) { return $ip }
    } catch {}

    return "unknown"
}

function Get-OSInfo {
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        return "$($os.Caption) $($os.Version) ($($os.OSArchitecture))"
    } catch {
        return "Windows $([System.Environment]::OSVersion.Version)"
    }
}

function Get-MacAddress {
    try {
        $mac = (Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.PhysicalMediaType -ne 'Unspecified' } |
            Sort-Object -Property InterfaceIndex |
            Select-Object -First 1).MacAddress
        if ($mac) { return $mac -replace '-', ':' }
    } catch {}
    return "unknown"
}

function Get-Manufacturer {
    try {
        $cs = Get-CimInstance Win32_ComputerSystem
        return $cs.Manufacturer
    } catch { return "Unknown" }
}

function Get-ModelInfo {
    try {
        $cs = Get-CimInstance Win32_ComputerSystem
        return $cs.Model
    } catch { return "Unknown" }
}

function Get-CpuInfoDetail {
    try {
        $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
        return $cpu.Name.Trim()
    } catch { return "Unknown" }
}

function Get-TotalMemoryGB {
    try {
        $cs = Get-CimInstance Win32_ComputerSystem
        return [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
    } catch { return 0 }
}

function Get-SystemTypeInfo {
    try {
        $cs = Get-CimInstance Win32_ComputerSystem
        $model = $cs.Model.ToLower()
        if ($model -match "virtual|vmware|kvm|qemu|xen|hyperv") {
            return "virtual-machine"
        }
        return "physical"
    } catch { return "unknown" }
}

function Get-SecurityAudit {
    $audit = @{}

    try {
        $fw = Get-NetFirewallProfile -ErrorAction SilentlyContinue
        $fwEnabled = ($fw | Where-Object { $_.Enabled -eq $true }).Count
        $fwTotal = ($fw | Measure-Object).Count
        $audit.firewall = "$fwEnabled/$fwTotal profiles enabled"
        $fwRules = (Get-NetFirewallRule -Enabled True -ErrorAction SilentlyContinue | Measure-Object).Count
        $audit.firewallRules = $fwRules
    } catch { $audit.firewall = "Unable to query" }

    try {
        $av = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue
        if ($av) {
            $audit.antivirus = ($av | ForEach-Object { $_.displayName }) -join ", "
        } else {
            $audit.antivirus = "Windows Defender (default)"
        }
    } catch { $audit.antivirus = "Unable to query" }

    try {
        $lastBoot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
        $uptime = (Get-Date) - $lastBoot
        $audit.uptime = "$([math]::Floor($uptime.TotalDays)) days $($uptime.Hours):$($uptime.Minutes.ToString('00')):$($uptime.Seconds.ToString('00'))"
        $audit.lastBoot = $lastBoot.ToString("yyyy-MM-dd HH:mm:ss")
    } catch { $audit.uptime = "Unknown" }

    try {
        $hotfixes = Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending
        $audit.installedPatches = ($hotfixes | Measure-Object).Count
        if ($hotfixes -and $hotfixes.Count -gt 0) {
            $latest = $hotfixes[0]
            $audit.lastPatched = "Unknown"
            if ($latest.InstalledOn) { $audit.lastPatched = $latest.InstalledOn.ToString("yyyy-MM-dd") }
            $audit.latestPatchId = $latest.HotFixID
        } else {
            $audit.lastPatched = "Unknown"
        }
    } catch { $audit.installedPatches = 0; $audit.lastPatched = "Unknown" }

    try {
        $autoUpdate = (New-Object -ComObject Microsoft.Update.AutoUpdate -ErrorAction SilentlyContinue)
        if ($autoUpdate) {
            $audit.autoUpdates = "Enabled"
        } else {
            $audit.autoUpdates = "Unknown"
        }
    } catch { $audit.autoUpdates = "Unknown" }

    try {
        $rdp = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name fDenyTSConnections -ErrorAction SilentlyContinue).fDenyTSConnections
        $audit.rdpEnabled = "Disabled"
        if ($rdp -eq 0) { $audit.rdpEnabled = "Enabled" }
    } catch { $audit.rdpEnabled = "Unknown" }

    try {
        $uac = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name EnableLUA -ErrorAction SilentlyContinue).EnableLUA
        $audit.uac = "Disabled"
        if ($uac -eq 1) { $audit.uac = "Enabled" }
    } catch { $audit.uac = "Unknown" }

    try {
        $bitlocker = Get-BitLockerVolume -MountPoint "C:" -ErrorAction SilentlyContinue
        if ($bitlocker) {
            $audit.diskEncryption = "BitLocker: $($bitlocker.ProtectionStatus)"
        } else {
            $audit.diskEncryption = "BitLocker: Not detected"
        }
    } catch { $audit.diskEncryption = "Unable to query" }

    try {
        $shares = Get-SmbShare -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '^\$' -and $_.Name -ne "IPC$" }
        $audit.networkShares = ($shares | Measure-Object).Count
    } catch { $audit.networkShares = 0 }

    try {
        $localAdmins = net localgroup administrators 2>$null | Where-Object { $_ -and $_ -notmatch "^(The command|Members|---|-$|Alias)" }
        $audit.localAdminCount = ($localAdmins | Measure-Object).Count
    } catch { $audit.localAdminCount = 0 }

    return $audit
}

function Get-NetworkInterfaces {
    $interfaces = @()
    $sampleInterval = 2
    try {
        $adapters = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Up" }
        if (-not $adapters -or $adapters.Count -eq 0) {
            Write-Log "No active network adapters found via Get-NetAdapter" -Level WARN
        }
        $sample1 = @{}
        $useWmiFallback = $false
        foreach ($adapter in $adapters) {
            try {
                $stats = Get-NetAdapterStatistics -Name $adapter.Name -ErrorAction Stop
                if ($stats) {
                    $sample1[$adapter.Name] = @{
                        rx = [long]$stats.ReceivedBytes
                        tx = [long]$stats.SentBytes
                    }
                }
            } catch {
                Write-Log "Get-NetAdapterStatistics failed for $($adapter.Name): $_ -- will try WMI fallback" -Level WARN
                $useWmiFallback = $true
            }
        }
        if ($useWmiFallback -and $sample1.Count -eq 0) {
            try {
                $wmiAdapters = Get-CimInstance -ClassName Win32_PerfRawData_Tcpip_NetworkInterface -ErrorAction Stop
                foreach ($wmi in $wmiAdapters) {
                    $matchedAdapter = $adapters | Where-Object { $wmi.Name -like "*$($_.InterfaceDescription)*" -or $wmi.Name -like "*$($_.Name)*" } | Select-Object -First 1
                    if ($matchedAdapter) {
                        $sample1[$matchedAdapter.Name] = @{
                            rx = [long]$wmi.BytesReceivedPersec
                            tx = [long]$wmi.BytesSentPersec
                            wmi = $true
                        }
                    }
                }
                Write-Log "WMI fallback collected stats for $($sample1.Count) adapter(s)" -Level INFO
            } catch {
                Write-Log "WMI fallback also failed: $_" -Level WARN
            }
        }
        if ($sample1.Count -gt 0) {
            Start-Sleep -Seconds $sampleInterval
        }
        foreach ($adapter in $adapters) {
            $speed = "Unknown"
            if ($adapter.LinkSpeed) { $speed = $adapter.LinkSpeed }
            $utilPct = 0
            $rxDelta = 0
            $txDelta = 0
            try {
                if ($sample1.ContainsKey($adapter.Name)) {
                    $s1 = $sample1[$adapter.Name]
                    if ($s1.wmi) {
                        $wmiAdapters2 = Get-CimInstance -ClassName Win32_PerfRawData_Tcpip_NetworkInterface -ErrorAction Stop
                        $wmi2 = $wmiAdapters2 | Where-Object { $_.Name -like "*$($adapter.InterfaceDescription)*" -or $_.Name -like "*$($adapter.Name)*" } | Select-Object -First 1
                        if ($wmi2) {
                            $rxDelta = [math]::Max(0, [long]$wmi2.BytesReceivedPersec - $s1.rx)
                            $txDelta = [math]::Max(0, [long]$wmi2.BytesSentPersec - $s1.tx)
                        }
                    } else {
                        $stats2 = Get-NetAdapterStatistics -Name $adapter.Name -ErrorAction Stop
                        if ($stats2) {
                            $rxDelta = [math]::Max(0, [long]$stats2.ReceivedBytes - $s1.rx)
                            $txDelta = [math]::Max(0, [long]$stats2.SentBytes - $s1.tx)
                        }
                    }
                    $rxPerSec = [math]::Round($rxDelta / $sampleInterval)
                    $txPerSec = [math]::Round($txDelta / $sampleInterval)
                    $totalBytesPerSec = $rxPerSec + $txPerSec
                    $totalBitsPerSec = $totalBytesPerSec * 8
                    $speedNum = 0
                    $rawSpeed = $adapter.LinkSpeed
                    if ($rawSpeed -match '(\d+(?:\.\d+)?)\s*Gbps') { $speedNum = [double]$Matches[1] * 1e9 }
                    elseif ($rawSpeed -match '(\d+(?:\.\d+)?)\s*Mbps') { $speedNum = [double]$Matches[1] * 1e6 }
                    elseif ($rawSpeed -match '(\d+(?:\.\d+)?)\s*Kbps') { $speedNum = [double]$Matches[1] * 1e3 }
                    if ($speedNum -gt 0) {
                        $utilPct = [math]::Round(($totalBitsPerSec / $speedNum) * 100, 1)
                        if ($utilPct -gt 100) { $utilPct = 100 }
                    }
                    $rxDelta = $rxPerSec
                    $txDelta = $txPerSec
                }
            } catch {
                Write-Log "Throughput calc failed for $($adapter.Name): $_" -Level WARN
            }
            $interfaces += @{
                name = $adapter.Name
                type = $adapter.InterfaceDescription
                status = "active"
                bandwidth = $speed
                utilization = "$utilPct%"
                vlan = "N/A"
                rxBytesPerSec = [long]$rxDelta
                txBytesPerSec = [long]$txDelta
            }
        }
    } catch {
        Write-Log "Get-NetworkInterfaces outer error: $_" -Level ERROR
    }
    if ($interfaces.Count -eq 0) {
        try {
            $ipConfigs = Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4Address }
            foreach ($ipc in $ipConfigs) {
                $bw = "Unknown"
                try {
                    $na = Get-NetAdapter -InterfaceIndex $ipc.InterfaceIndex -ErrorAction SilentlyContinue
                    if ($na -and $na.LinkSpeed) { $bw = $na.LinkSpeed }
                } catch {
                    $bw = "Unknown"
                }
                $interfaces += @{
                    name = $ipc.InterfaceAlias
                    type = "Detected via IP config"
                    status = "active"
                    bandwidth = $bw
                    utilization = "0%"
                    vlan = "N/A"
                    rxBytesPerSec = 0
                    txBytesPerSec = 0
                }
            }
            if ($interfaces.Count -gt 0) {
                Write-Log "Used Get-NetIPConfiguration fallback -- found $($interfaces.Count) interface(s)" -Level WARN
            }
        } catch {
            Write-Log "Get-NetIPConfiguration fallback error: $_" -Level WARN
        }
    }
    if ($interfaces.Count -eq 0) {
        Write-Log "All network interface detection methods failed -- returning placeholder" -Level ERROR
        $interfaces += @{ name = "Unknown"; type = "Unknown"; status = "active"; bandwidth = "Unknown"; utilization = "0%"; vlan = "N/A"; rxBytesPerSec = 0; txBytesPerSec = 0 }
    }
    return $interfaces
}

function Get-InstalledSoftwareSummary {
    $summary = @{}
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $summary.os = $os.Caption
        $summary.version = $os.Version
        $summary.buildNumber = $os.BuildNumber
        $summary.servicePackMajor = $os.ServicePackMajorVersion
        $summary.lastBoot = $os.LastBootUpTime.ToString("yyyy-MM-dd HH:mm:ss")
        $uptime = (Get-Date) - $os.LastBootUpTime
        $summary.uptime = "$([math]::Floor($uptime.TotalDays)) days $($uptime.Hours):$($uptime.Minutes.ToString('00')):$($uptime.Seconds.ToString('00'))"
    } catch {}

    try {
        # Run registry scan in a background job with a 30s timeout so VMs never freeze the probe.
        $regJob = Start-Job -ScriptBlock {
            Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
                             "HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" `
                -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName } |
            Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, EstimatedSize
        }
        $jobDone = Wait-Job $regJob -Timeout 30
        if ($jobDone) {
            $appsList = @(Receive-Job $regJob | Sort-Object DisplayName -Unique)
        } else {
            Stop-Job $regJob
            $appsList = @()
            Write-Warning "[PROBE] Software inventory registry scan timed out after 30s"
        }
        Remove-Job $regJob -Force -ErrorAction SilentlyContinue

        $summary.installedPackages = $appsList.Count
        $summary.installedApps = @($appsList | ForEach-Object {
            $ver = ""
            if ($_.DisplayVersion) { $ver = $_.DisplayVersion }
            $pub = ""
            if ($_.Publisher) { $pub = $_.Publisher }
            $idate = ""
            if ($_.InstallDate) { $idate = $_.InstallDate }
            $sz = 0
            if ($_.EstimatedSize) { $sz = [math]::Round($_.EstimatedSize / 1024, 1) }
            @{
                name = $_.DisplayName
                version = $ver
                publisher = $pub
                installDate = $idate
                sizeMB = $sz
            }
        })
    } catch {
        $summary.installedPackages = 0
        $summary.installedApps = @()
    }

    try {
        $dotnet = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" -ErrorAction SilentlyContinue).Version
        if ($dotnet) { $summary.dotNetVersion = $dotnet }
    } catch {}

    try {
        $ps = $PSVersionTable.PSVersion
        $summary.powershellVersion = "$($ps.Major).$($ps.Minor).$($ps.Build)"
    } catch {}

    return $summary
}

function Get-SoftwareHash {
    param([array]$AppsList)
    if (-not $AppsList -or $AppsList.Count -eq 0) { return "" }
    $nl = [char]10
    $canonical = ($AppsList | ForEach-Object { "$($_.name)|$($_.version)" } | Sort-Object) -join $nl
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
    $hash = $sha.ComputeHash($bytes)
    return ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Get-StorageInfo {
    $storage = @()
    try {
        $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"
        foreach ($disk in $disks) {
            $sizeGB = [math]::Round($disk.Size / 1GB, 1)
            $freeGB = [math]::Round($disk.FreeSpace / 1GB, 1)
            $usedPct = [math]::Round(($disk.Size - $disk.FreeSpace) / $disk.Size * 100, 1)
            $storage += @{
                drive = $disk.DeviceID
                totalGB = $sizeGB
                freeGB = $freeGB
                usedPercent = $usedPct
                fileSystem = $disk.FileSystem
            }
        }
    } catch {}
    return $storage
}

function Get-CpuUsage {
    try {
        $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
        return [math]::Round($cpu, 1)
    } catch { return 0 }
}

function Get-MemoryUsage {
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $used = $os.TotalVisibleMemorySize - $os.FreePhysicalMemory
        return [math]::Round(($used / $os.TotalVisibleMemorySize) * 100, 1)
    } catch { return 0 }
}

function Get-DiskUsage {
    try {
        $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
        $used = $disk.Size - $disk.FreeSpace
        return [math]::Round(($used / $disk.Size) * 100, 1)
    } catch { return 0 }
}

function Get-HmacSignature {
    param(
        [string]$Secret,
        [string]$Timestamp,
        [string]$Nonce,
        [string]$BodyJson
    )
    $payload = "$Timestamp.$Nonce.$BodyJson"
    $hmacsha = New-Object System.Security.Cryptography.HMACSHA256
    $hmacsha.Key = [System.Text.Encoding]::UTF8.GetBytes($Secret)
    $hash = $hmacsha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($payload))
    return ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Get-UnixTimestampMs {
    return [long]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
}

function Get-SecureNonce {
    $bytes = New-Object byte[] 16
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Invoke-HolocronApi {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body
    )

    $url = "$ApiUrl$Endpoint"
    $headers = @{ "Content-Type" = "application/json" }
    $bodyJson = ""

    if ($Body) {
        $bodyJson = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }

    if ($HmacSecret) {
        $timestamp = Get-UnixTimestampMs
        $nonce = Get-SecureNonce
        $signature = Get-HmacSignature -Secret $HmacSecret -Timestamp "$timestamp" -Nonce $nonce -BodyJson $bodyJson
        $headers["X-Holocron-Signature"] = $signature
        $headers["X-Holocron-Timestamp"] = "$timestamp"
        $headers["X-Holocron-Nonce"] = $nonce
    }

    $params = @{
        Uri         = $url
        Method      = $Method
        Headers     = $headers
        ContentType = "application/json"
        TimeoutSec  = 30
    }

    if ($bodyJson) {
        $params.Body = $bodyJson
    }

    try {
        $response = Invoke-RestMethod @params
        return $response
    } catch {
        $statusCode = 0
        $errorBody = ""
        try { $statusCode = $_.Exception.Response.StatusCode.value__ } catch {}
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $reader.Close()
        } catch {
            try { $errorBody = $_.ErrorDetails.Message } catch {}
        }
        if (-not $errorBody) { $errorBody = $_.Exception.Message }
        if ($statusCode -eq 401) {
            throw "HTTP 401 (Unauthorized): $errorBody - Verify your site token matches a probe configured in HOLOCRON AI"
        }
        throw "HTTP $statusCode : $errorBody"
    }
}

function Invoke-Enrollment {
    $myHostname = Get-SystemHostname
    $myIp = Get-PrimaryIP
    $myOs = Get-OSInfo
    $myMac = Get-MacAddress
    $myManufacturer = Get-Manufacturer
    $myModel = Get-ModelInfo
    $myCpu = Get-CpuInfoDetail
    $myMemGB = Get-TotalMemoryGB
    $mySysType = Get-SystemTypeInfo

    Write-Log "Enrolling probe with HOLOCRON AI..."
    if ($HmacSecret) {
        Write-Log "  HMAC Signing: Enabled (secret configured)" -Level "INFO"
    } else {
        Write-Log "  HMAC Signing: DISABLED (no -HmacSecret provided)" -Level "WARN"
    }
    Write-Log "  Hostname:     $myHostname"
    Write-Log "  IP:           $myIp"
    Write-Log "  MAC:          $myMac"
    Write-Log "  OS:           $myOs"
    Write-Log "  Manufacturer: $myManufacturer"
    Write-Log "  Model:        $myModel"
    Write-Log "  CPU:          $myCpu"
    Write-Log "  Memory:       $myMemGB GB"
    Write-Log "  System Type:  $mySysType"

    Write-Log "Collecting security audit data..."
    $secAudit = Get-SecurityAudit
    Write-Log "  Firewall:     $($secAudit.firewall)"
    Write-Log "  Antivirus:    $($secAudit.antivirus)"
    Write-Log "  Patches:      $($secAudit.installedPatches) installed"
    Write-Log "  Last Patched: $($secAudit.lastPatched)"
    Write-Log "  UAC:          $($secAudit.uac)"
    Write-Log "  Encryption:   $($secAudit.diskEncryption)"

    Write-Log "Collecting network interfaces..."
    $netInterfaces = Get-NetworkInterfaces
    Write-Log "  Interfaces:   $($netInterfaces.Count) active"

    Write-Log "Collecting software inventory..."
    $softwareSummary = Get-InstalledSoftwareSummary
    Write-Log "  Packages:     $($softwareSummary.installedPackages) installed"

    Write-Log "Collecting storage info..."
    $storageInfo = Get-StorageInfo
    Write-Log "  Drives:       $($storageInfo.Count) found"

    $storageStr = ($storageInfo | ForEach-Object { "$($_.drive) $($_.totalGB)GB ($($_.fileSystem))" }) -join " + "

    try {
        $result = Invoke-HolocronApi -Method POST -Endpoint "/api/probe-enroll" -Body @{
            siteToken      = $Token
            hostname       = $myHostname
            ipAddress      = $myIp
            osInfo         = $myOs
            probeVersion   = $ProbeVersion
            deploymentType = "bare-metal"
            macAddress     = $myMac
            manufacturer   = $myManufacturer
            model          = $myModel
            cpuInfo        = $myCpu
            totalMemoryGB  = $myMemGB
            systemType     = $mySysType
            securityAudit  = $secAudit
            networkInterfaces = $netInterfaces
            softwareSummary = $softwareSummary
            storageInfo    = $storageStr
        }

        if ($result.success) {
            Write-Log "Probe enrolled successfully (ID: $($result.probeId))" -Level SUCCESS
            return $true
        } else {
            Write-Log "Enrollment failed: $($result.error)" -Level ERROR
            return $false
        }
    } catch {
        Write-Log "Enrollment failed: $_" -Level ERROR
        return $false
    }
}

function Invoke-RemediationTask {
    param(
        [string]$TaskId,
        [string]$Title,
        [string]$Script,
        [string]$ScriptType = "powershell",
        [bool]$IsRollback = $false,
        [int]$TimeoutSeconds = 1800
    )

    $taskLabel = if ($IsRollback) { "ROLLBACK" } else { "REMEDIATION" }
    $statusPrefix = if ($IsRollback) { "rollback_" } else { "" }

    Write-Log "=== $taskLabel TASK: $Title ===" -Level WARN
    Write-Log "Task ID: $TaskId | Type: $ScriptType | Rollback: $IsRollback" -Level INFO

    try {
        Invoke-HolocronApi -Method POST -Endpoint "/api/remediation-tasks/$TaskId/report" -Body @{
            token  = $Token
            status = "${statusPrefix}executing"
        } | Out-Null
        Write-Log "Reported '${statusPrefix}executing' status to server" -Level INFO
    } catch {
        Write-Log "Could not report executing status: $_" -Level WARN
    }

    try {
        $tempFile = [System.IO.Path]::GetTempFileName()
        if ($ScriptType -eq "powershell") {
            $tempFile = $tempFile -replace '\.tmp$', '.ps1'
        } else {
            $tempFile = $tempFile -replace '\.tmp$', '.sh'
        }
        Set-Content -Path $tempFile -Value $Script -Encoding UTF8

        $output = ""
        $exitCode = 0

        if ($ScriptType -eq "powershell") {
            $pinfo = New-Object System.Diagnostics.ProcessStartInfo
            $pinfo.FileName = "powershell.exe"
            $pinfo.Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$tempFile`""
            $pinfo.RedirectStandardOutput = $true
            $pinfo.RedirectStandardError = $true
            $pinfo.UseShellExecute = $false
            $pinfo.CreateNoWindow = $true

            $process = New-Object System.Diagnostics.Process
            $process.StartInfo = $pinfo
            $process.Start() | Out-Null

            $stdoutTask = $process.StandardOutput.ReadToEndAsync()
            $stderrTask = $process.StandardError.ReadToEndAsync()

            $timeoutMs = $TimeoutSeconds * 1000
            $timedOut = -not $process.WaitForExit($timeoutMs)
            if ($timedOut) {
                $process.Kill()
                throw "Script execution timed out after $TimeoutSeconds seconds"
            }

            $output = $stdoutTask.Result
            $errOutput = $stderrTask.Result
            $exitCode = $process.ExitCode

            if ($errOutput) { $output += ([char]10 + "STDERR: $errOutput") }
            if (-not $output -and $exitCode -ne 0) {
                $output = "[No output captured. PowerShell exited with code $exitCode. The script may have failed during parsing or initialization. Check the remediation script for syntax errors.]"
            }
        } else {
            $output = & bash $tempFile 2>&1 | Out-String
            $exitCode = $LASTEXITCODE
            if (-not $output -and $exitCode -ne 0) {
                $output = "[No output captured. Bash exited with code $exitCode.]"
            }
        }

        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue

        if ($output.Length -gt 4000) { $output = $output.Substring(0, 4000) + "... [truncated]" }

        if ($exitCode -eq 0) {
            Write-Log "$taskLabel completed successfully" -Level SUCCESS
            try {
                Invoke-HolocronApi -Method POST -Endpoint "/api/remediation-tasks/$TaskId/report" -Body @{
                    token  = $Token
                    status = "${statusPrefix}completed"
                    result = $output
                } | Out-Null
            } catch {
                Write-Log "Could not report completion: $_" -Level WARN
            }
        } else {
            Write-Log "$taskLabel script exited with code $exitCode" -Level ERROR
            try {
                Invoke-HolocronApi -Method POST -Endpoint "/api/remediation-tasks/$TaskId/report" -Body @{
                    token  = $Token
                    status = "${statusPrefix}failed"
                    error  = "Exit code $exitCode. Output: $output"
                } | Out-Null
            } catch {
                Write-Log "Could not report failure: $_" -Level WARN
            }
        }
    } catch {
        Write-Log "$taskLabel execution failed: $_" -Level ERROR
        try {
            Invoke-HolocronApi -Method POST -Endpoint "/api/remediation-tasks/$TaskId/report" -Body @{
                token  = $Token
                status = "${statusPrefix}failed"
                error  = "$_"
            } | Out-Null
        } catch {
            Write-Log "Could not report error: $_" -Level WARN
        }
    }
}

$script:DataBuffer = [System.Collections.ArrayList]::new()
$script:BufferMaxEntries = 10000
$script:ServerConnected = $true
$script:LastSoftwareHash = ""
$script:ForceFullSoftware = $true
$script:HeartbeatCount = 0
$script:CollectionSchedule = $null
$script:LastFlushTime = $null
$script:TaskLastRun = @{}

function Add-ToBuffer {
    param(
        [string]$TaskType,
        [hashtable]$Data
    )
    $entry = @{
        taskType  = $TaskType
        timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        hostname  = Get-SystemHostname
        ipAddress = Get-PrimaryIP
        data      = $Data
    }
    $null = $script:DataBuffer.Add($entry)
    if ($script:DataBuffer.Count -gt $script:BufferMaxEntries) {
        $excess = $script:DataBuffer.Count - $script:BufferMaxEntries
        $script:DataBuffer.RemoveRange(0, $excess)
        Write-Log "Buffer overflow: evicted $excess oldest entries (max: $script:BufferMaxEntries)" -Level WARN
    }
}

function Get-BufferStatus {
    $oldest = $null
    if ($script:DataBuffer.Count -gt 0) {
        $oldest = $script:DataBuffer[0].timestamp
    }
    return @{
        entries     = $script:DataBuffer.Count
        maxEntries  = $script:BufferMaxEntries
        oldestEntry = $oldest
        lastFlush   = $(if ($script:LastFlushTime) { $script:LastFlushTime } else { $null })
        connected   = $script:ServerConnected
    }
}

function Invoke-ScheduledCollection {
    param([string]$TaskName)

    $myHostname = Get-SystemHostname
    $myIp = Get-PrimaryIP

    switch ($TaskName) {
        "metrics" {
            $data = @{
                cpuUsage    = Get-CpuUsage
                memoryUsage = Get-MemoryUsage
                diskUsage   = Get-DiskUsage
            }
            Add-ToBuffer -TaskType "metrics" -Data $data
            Write-Log "  [SCHED] Collected metrics (CPU: $($data.cpuUsage)%, Mem: $($data.memoryUsage)%, Disk: $($data.diskUsage)%)"
        }
        "networkInterfaces" {
            try {
                $ifaces = @(Get-NetworkInterfaces)
                Add-ToBuffer -TaskType "networkInterfaces" -Data @{ interfaces = $ifaces }
                Write-Log "  [SCHED] Collected $($ifaces.Count) network interface(s)"
            } catch {
                Write-Log "  [SCHED] Network interface collection failed: $_" -Level WARN
            }
        }
        "securityAudit" {
            try {
                $audit = Get-SecurityAudit
                Add-ToBuffer -TaskType "securityAudit" -Data $audit
                Write-Log "  [SCHED] Collected security audit (patches: $($audit.installedPatches))"
            } catch {
                Write-Log "  [SCHED] Security audit failed: $_" -Level WARN
            }
        }
        "softwareInventory" {
            try {
                $sw = Get-InstalledSoftwareSummary
                $currentHash = Get-SoftwareHash -AppsList $sw.installedApps
                $sendFull = $script:ForceFullSoftware -or ($currentHash -ne $script:LastSoftwareHash)
                $data = @{
                    os = $sw.os
                    version = $sw.version
                    buildNumber = $sw.buildNumber
                    uptime = $sw.uptime
                    installedPackages = $sw.installedPackages
                    softwareHash = $currentHash
                }
                if ($sendFull) {
                    $data.installedApps = $sw.installedApps
                    $script:LastSoftwareHash = $currentHash
                    $script:ForceFullSoftware = $false
                    Write-Log "  [SCHED] Software inventory: FULL ($($sw.installedPackages) apps, hash: $($currentHash.Substring(0,8))...)"
                } else {
                    Write-Log "  [SCHED] Software inventory: HASH only (unchanged: $($currentHash.Substring(0,8))...)"
                }
                Add-ToBuffer -TaskType "softwareInventory" -Data $data
            } catch {
                Write-Log "  [SCHED] Software inventory failed: $_" -Level WARN
            }
        }
        "storageInfo" {
            try {
                $storage = Get-StorageInfo
                Add-ToBuffer -TaskType "storageInfo" -Data @{ volumes = $storage }
                Write-Log "  [SCHED] Collected storage info ($($storage.Count) volume(s))"
            } catch {
                Write-Log "  [SCHED] Storage info failed: $_" -Level WARN
            }
        }
    }
    $script:TaskLastRun[$TaskName] = Get-Date
}

function Get-ScheduledTasks {
    if ($script:CollectionSchedule -and $script:CollectionSchedule.scheduled) {
        return $script:CollectionSchedule.scheduled
    }
    return @(
        @{ task = "metrics"; interval = 60 },
        @{ task = "networkInterfaces"; interval = 60 },
        @{ task = "securityAudit"; interval = 600 },
        @{ task = "softwareInventory"; interval = 600 },
        @{ task = "storageInfo"; interval = 3600 }
    )
}

function Invoke-DueCollections {
    # Run at most ONE due collection per call so the main loop — and heartbeats —
    # are never blocked for more than a single task's execution time.
    # Tasks are prioritised by how overdue they are (most overdue runs first).
    $now = Get-Date
    $tasks = Get-ScheduledTasks

    $mostOverdue = $null
    $maxOverdueSeconds = -1

    foreach ($t in $tasks) {
        $taskName = $t.task
        $interval = [int]$t.interval
        $lastRun  = $script:TaskLastRun[$taskName]
        $overdueBy = if (-not $lastRun) { [int]::MaxValue } else { ($now - $lastRun).TotalSeconds - $interval }
        if ($overdueBy -gt 0 -and $overdueBy -gt $maxOverdueSeconds) {
            $maxOverdueSeconds = $overdueBy
            $mostOverdue = $taskName
        }
    }

    if ($mostOverdue) {
        try {
            Invoke-ScheduledCollection -TaskName $mostOverdue
        } catch {
            Write-Log "  [SCHED] Task '$mostOverdue' failed: $_" -Level ERROR
            $script:TaskLastRun[$mostOverdue] = Get-Date
        }
    }
}

function Flush-Buffer {
    if ($script:DataBuffer.Count -eq 0) { return $true }

    $batchSize = 500
    if ($script:CollectionSchedule -and $script:CollectionSchedule.bufferConfig) {
        $batchSize = [int]$script:CollectionSchedule.bufferConfig.flushBatchSize
        if ($batchSize -le 0) { $batchSize = 500 }
    }

    $totalFlushed = 0
    # Collect tasks dispatched by the server across all flush batches — process after flush
    $pendingTasksToRun    = [System.Collections.ArrayList]::new()
    $pendingRollbacksToRun = [System.Collections.ArrayList]::new()

    while ($script:DataBuffer.Count -gt 0) {
        $count = [math]::Min($batchSize, $script:DataBuffer.Count)
        $batch = $script:DataBuffer.GetRange(0, $count)

        try {
            $result = Invoke-HolocronApi -Method POST -Endpoint "/api/probe-heartbeat-buffered" -Body @{
                siteToken    = $Token
                bufferedData = @($batch)
            }
            if ($result.success) {
                $script:DataBuffer.RemoveRange(0, $count)
                $totalFlushed += $result.processed
                Write-Log "  [FLUSH] Sent $count entries (processed: $($result.processed), errors: $($result.errors))" -Level SUCCESS

                # Capture any tasks the server piggybacked on this flush response
                if ($result.pendingTasks -and $result.pendingTasks.Count -gt 0) {
                    foreach ($t in $result.pendingTasks) { $null = $pendingTasksToRun.Add($t) }
                    Write-Log "  [FLUSH] Server piggybacked $($result.pendingTasks.Count) remediation task(s) — will execute after flush" -Level WARN
                }
                if ($result.pendingRollbacks -and $result.pendingRollbacks.Count -gt 0) {
                    foreach ($t in $result.pendingRollbacks) { $null = $pendingRollbacksToRun.Add($t) }
                    Write-Log "  [FLUSH] Server piggybacked $($result.pendingRollbacks.Count) rollback(s) — will execute after flush" -Level WARN
                }
            } else {
                Write-Log "  [FLUSH] Server rejected batch" -Level WARN
                return $false
            }
        } catch {
            Write-Log "  [FLUSH] Failed to send buffered data: $_" -Level ERROR
            return $false
        }
    }

    if ($totalFlushed -gt 0) {
        $script:LastFlushTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        Write-Log "  [FLUSH] Complete: $totalFlushed entries flushed, buffer empty" -Level SUCCESS
    }

    # Execute remediation tasks received during the flush
    foreach ($task in $pendingTasksToRun) {
        $taskTimeout = 1800
        if ($task.timeoutSeconds -and $task.timeoutSeconds -gt 0) { $taskTimeout = [int]$task.timeoutSeconds }
        Write-Log "  [FLUSH] Starting remediation task: $($task.title)" -Level WARN
        Invoke-RemediationTask -TaskId $task.id -Title $task.title -Script $task.script -ScriptType $task.scriptType -TimeoutSeconds $taskTimeout
    }

    foreach ($task in $pendingRollbacksToRun) {
        $taskTimeout = 1800
        if ($task.timeoutSeconds -and $task.timeoutSeconds -gt 0) { $taskTimeout = [int]$task.timeoutSeconds }
        Write-Log "  [FLUSH] Starting rollback task: $($task.title)" -Level WARN
        Invoke-RemediationTask -TaskId $task.id -Title $task.title -Script $task.script -ScriptType $task.scriptType -IsRollback $true -TimeoutSeconds $taskTimeout
    }

    return $true
}

function Send-Heartbeat {
    $myHostname = Get-SystemHostname
    $myIp = Get-PrimaryIP
    $myOs = Get-OSInfo
    $cpu = Get-CpuUsage
    $mem = Get-MemoryUsage
    $disk = Get-DiskUsage

    $heartbeatBody = @{
        siteToken         = $Token
        hostname          = $myHostname
        ipAddress         = $myIp
        osInfo            = $myOs
        probeVersion      = $ProbeVersion
        cpuUsage          = $cpu
        memoryUsage       = $mem
        diskUsage         = $disk
        taskQueueDepth    = 0
        activeTasks       = 0
        avgScanDurationMs = 0
        bufferStatus      = Get-BufferStatus
    }

    $script:HeartbeatCount++
    try {
        $heartbeatBody.networkInterfaces = @(Get-NetworkInterfaces)
    } catch {
        Write-Log "Could not collect network interface data: $_" -Level WARN
    }
    $sendFullSoftware = $script:ForceFullSoftware -or ($script:HeartbeatCount -eq 1) -or (($script:HeartbeatCount % 10) -eq 0)
    if ($sendFullSoftware -or ($script:HeartbeatCount % 10) -eq 0) {
        try {
            $heartbeatBody.securityAudit = Get-SecurityAudit
            $sw = Get-InstalledSoftwareSummary
            $currentHash = Get-SoftwareHash -AppsList $sw.installedApps
            if ($sendFullSoftware -or ($currentHash -ne $script:LastSoftwareHash)) {
                $sw.softwareHash = $currentHash
                $heartbeatBody.softwareSummary = $sw
                $script:LastSoftwareHash = $currentHash
                $script:ForceFullSoftware = $false
            } else {
                $heartbeatBody.softwareSummary = @{
                    os = $sw.os; version = $sw.version; buildNumber = $sw.buildNumber
                    uptime = $sw.uptime; installedPackages = $sw.installedPackages; softwareHash = $currentHash
                }
            }
        } catch {
            Write-Log "Could not collect extended data: $_" -Level WARN
        }
    }

    try {
        $result = Invoke-HolocronApi -Method POST -Endpoint "/api/probe-heartbeat" -Body $heartbeatBody

        if ($result.success) {
            $script:ServerConnected = $true
            if ($result.nextHeartbeat -and $result.nextHeartbeat -gt 0) {
                $script:HeartbeatInterval = $result.nextHeartbeat
            }
            Write-Log "Heartbeat OK (CPU: ${cpu}%, Mem: ${mem}%, Disk: ${disk}%, Buf: $($script:DataBuffer.Count), Next: $($script:HeartbeatInterval)s)" -Level SUCCESS

            if ($result.collectionSchedule) {
                $script:CollectionSchedule = $result.collectionSchedule
            }

            if ($result.requestSoftwareInventory -eq $true) {
                Write-Log "Server requested full software inventory" -Level WARN
                $script:ForceFullSoftware = $true
            }

            if ($result.pendingTasks -and $result.pendingTasks.Count -gt 0) {
                Write-Log "Received $($result.pendingTasks.Count) remediation task(s)" -Level WARN
                foreach ($task in $result.pendingTasks) {
                    $taskTimeout = 1800
                    if ($task.timeoutSeconds -and $task.timeoutSeconds -gt 0) {
                        $taskTimeout = [int]$task.timeoutSeconds
                    }
                    Write-Log "Task '$($task.title)' timeout: $taskTimeout seconds" -Level INFO
                    Invoke-RemediationTask -TaskId $task.id -Title $task.title -Script $task.script -ScriptType $task.scriptType -TimeoutSeconds $taskTimeout
                }
            }

            if ($result.pendingRollbacks -and $result.pendingRollbacks.Count -gt 0) {
                Write-Log "Received $($result.pendingRollbacks.Count) ROLLBACK task(s)" -Level WARN
                foreach ($task in $result.pendingRollbacks) {
                    $rollbackTimeout = 1800
                    if ($task.timeoutSeconds -and $task.timeoutSeconds -gt 0) {
                        $rollbackTimeout = [int]$task.timeoutSeconds
                    }
                    Invoke-RemediationTask -TaskId $task.id -Title $task.title -Script $task.script -ScriptType $task.scriptType -IsRollback $true -TimeoutSeconds $rollbackTimeout
                }
            }

            return $true
        }
        return $false
    } catch {
        if ($script:ServerConnected) {
            Write-Log "Server connection lost. Switching to OFFLINE mode. Data collection continues locally." -Level WARN
            $script:ServerConnected = $false
        }
        return $false
    }
}

function Get-RemoteServerMetrics {
    param([string]$ServerName)
    try {
        $cpu = Invoke-Command -ComputerName $ServerName -ScriptBlock {
            (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
        } -ErrorAction Stop
        $os = Invoke-Command -ComputerName $ServerName -ScriptBlock {
            $o = Get-CimInstance Win32_OperatingSystem
            @{ total = $o.TotalVisibleMemorySize; free = $o.FreePhysicalMemory }
        } -ErrorAction Stop
        $mem = [math]::Round(($os.total - $os.free) / $os.total * 100, 1)
        $disk = Invoke-Command -ComputerName $ServerName -ScriptBlock {
            $d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
            [math]::Round(($d.Size - $d.FreeSpace) / $d.Size * 100, 1)
        } -ErrorAction Stop
        $ip = Invoke-Command -ComputerName $ServerName -ScriptBlock {
            (Get-NetIPAddress -AddressFamily IPv4 -Type Unicast | Where-Object { $_.IPAddress -ne "127.0.0.1" } | Select-Object -First 1).IPAddress
        } -ErrorAction SilentlyContinue

        return @{
            hostname = $ServerName
            ipAddress = $(if ($ip) { $ip } else { $ServerName })
            cpuUsage = [math]::Round($cpu, 1)
            memoryUsage = $mem
            diskUsage = $disk
        }
    } catch {
        Write-Log "Failed to collect metrics from $ServerName : $_" -Level WARN
        return $null
    }
}

function Send-BatchHeartbeat {
    $localServer = @{
        hostname = Get-SystemHostname
        ipAddress = Get-PrimaryIP
        cpuUsage = Get-CpuUsage
        memoryUsage = Get-MemoryUsage
        diskUsage = Get-DiskUsage
    }

    $serverList = @($localServer)

    foreach ($server in $ManagedServers) {
        if ($server -and $server.Trim() -ne "") {
            $metrics = Get-RemoteServerMetrics -ServerName $server.Trim()
            if ($metrics) { $serverList += $metrics }
        }
    }

    $batchBody = @{
        siteToken = $Token
        probeVersion = $ProbeVersion
        osInfo = Get-OSInfo
        serverCount = $serverList.Count
        servers = $serverList
        bufferStatus = Get-BufferStatus
    }

    try {
        $result = Invoke-HolocronApi -Method POST -Endpoint "/api/probe-heartbeat-batch" -Body $batchBody
        if ($result.success) {
            $script:ServerConnected = $true
            if ($result.nextHeartbeat -and $result.nextHeartbeat -gt 0) {
                $script:HeartbeatInterval = $result.nextHeartbeat
            }
            Write-Log "Batch heartbeat OK ($($serverList.Count) servers, Buf: $($script:DataBuffer.Count), Next: $($script:HeartbeatInterval)s)" -Level SUCCESS

            if ($result.collectionSchedule) {
                $script:CollectionSchedule = $result.collectionSchedule
            }

            if ($result.requestSoftwareInventory -and $result.requestSoftwareInventory.Count -gt 0) {
                $script:ForceFullSoftware = $true
            }
            if ($result.pendingTasks -and $result.pendingTasks.Count -gt 0) {
                foreach ($task in $result.pendingTasks) {
                    Invoke-RemediationTask -TaskId $task.id -Title $task.title -Script $task.script -ScriptType $task.scriptType
                }
            }
            return $true
        }
        return $false
    } catch {
        if ($script:ServerConnected) {
            Write-Log "Server connection lost. Switching to OFFLINE mode." -Level WARN
            $script:ServerConnected = $false
        }
        return $false
    }
}

function Start-ProbeDaemon {
    $retryCount = 0
    $maxRetries = 5
    $useBatchMode = $ManagedServers.Count -gt 0
    $syncInterval = $HeartbeatInterval
    $lastSyncAttempt = [datetime]::MinValue

    if ($useBatchMode) {
        Write-Log "Batch mode enabled: monitoring $($ManagedServers.Count) managed server(s) + local" -Level INFO
    }

    Write-Log "Task scheduler initialized. Scheduled tasks:" -Level INFO
    foreach ($t in (Get-ScheduledTasks)) {
        Write-Log "  - $($t.task): every $($t.interval)s" -Level INFO
    }
    Write-Log "Local buffer: max $script:BufferMaxEntries entries, flush batch 500" -Level INFO

    while ($true) {
        Invoke-DueCollections

        $now = Get-Date
        $timeSinceSync = ($now - $lastSyncAttempt).TotalSeconds
        if ($timeSinceSync -ge $syncInterval) {
            $lastSyncAttempt = $now

            $flushOk = Flush-Buffer
            if ($flushOk -and $script:DataBuffer.Count -eq 0) {
                if ($useBatchMode) {
                    $success = Send-BatchHeartbeat
                } else {
                    $success = Send-Heartbeat
                }

                if ($success) {
                    $retryCount = 0
                    $syncInterval = $script:HeartbeatInterval
                } else {
                    $retryCount++
                    $syncInterval = [math]::Min($HeartbeatInterval * [math]::Pow(2, $retryCount), 300)
                    if ($retryCount -ge $maxRetries) {
                        Write-Log "Max sync retries ($maxRetries). Will keep collecting offline. Re-enrolling..." -Level WARN
                        try { Invoke-Enrollment | Out-Null } catch {}
                        $retryCount = 0
                    }
                }
            } else {
                if (-not $flushOk) {
                    $retryCount++
                    $syncInterval = [math]::Min($HeartbeatInterval * [math]::Pow(2, $retryCount), 300)
                    Write-Log "Buffer flush failed. $($script:DataBuffer.Count) entries pending. Retry in ${syncInterval}s" -Level WARN
                }
            }
        }

        $tasks = Get-ScheduledTasks
        $minIntervalRaw = ($tasks | Where-Object { $_.interval -gt 0 } | ForEach-Object { [int]$_.interval } | Measure-Object -Minimum).Minimum
        $minInterval = 30
        if ($minIntervalRaw) { $minInterval = $minIntervalRaw }
        $sleepSec = [math]::Max(5, [math]::Min([int]$minInterval, [int]$syncInterval))
        Start-Sleep -Seconds $sleepSec
    }
}

function Install-ProbeService {
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Log "Installation requires Administrator privileges. Run PowerShell as Administrator." -Level ERROR
        return
    }

    if (-not (Test-Path $InstallPath)) {
        New-Item -Path $InstallPath -ItemType Directory -Force | Out-Null
    }

    $scriptSource = $MyInvocation.ScriptName
    if (-not $scriptSource) { $scriptSource = $PSCommandPath }
    if ($scriptSource -ne "$InstallPath\holocron-probe.ps1") {
        Copy-Item -Path $scriptSource -Destination "$InstallPath\holocron-probe.ps1" -Force
    }

    $confContent = "HOLOCRON_TOKEN=$Token`r`nHOLOCRON_HMAC_SECRET=$HmacSecret`r`nHOLOCRON_API=$ApiUrl"
    [System.IO.File]::WriteAllText("$InstallPath\probe.conf", $confContent, [System.Text.Encoding]::UTF8)

    $psArgRaw = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$InstallPath\holocron-probe.ps1`" -Token `"$Token`" -ApiUrl `"$ApiUrl`" -HmacSecret `"$HmacSecret`" -Command Start"
    $psArgXml = $psArgRaw.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;').Replace('"','&quot;').Replace("'",'&apos;')
    $taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>HOLOCRON AI Probe Agent</Description>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
    <Enabled>true</Enabled>
  </Settings>
  <Actions>
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>$psArgXml</Arguments>
    </Exec>
  </Actions>
</Task>
"@
    $xmlPath = "$InstallPath\holocron-task.xml"
    [System.IO.File]::WriteAllText($xmlPath, $taskXml, [System.Text.Encoding]::Unicode)

    $result = schtasks /Create /TN "$ServiceName" /XML "$xmlPath" /F 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Scheduled task registration failed (exit $LASTEXITCODE): $result" -Level ERROR
    } else {
        Write-Log "Scheduled task '$ServiceName' registered successfully" -Level SUCCESS
    }
    Remove-Item $xmlPath -Force -ErrorAction SilentlyContinue

    schtasks /Run /TN "$ServiceName" 2>&1 | Out-Null

    Write-Log "HOLOCRON Probe installed as scheduled task '$ServiceName'" -Level SUCCESS
    Write-Log "  Config: $InstallPath\probe.conf"
    Write-Log "  Logs: $LogPath"
    Write-Log "  Check status: .\holocron-probe.ps1 -Command Status"
}

function Uninstall-ProbeService {
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Log "Uninstall requires Administrator privileges." -Level ERROR
        return
    }

    try {
        Stop-ScheduledTask -TaskName $ServiceName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $ServiceName -Confirm:$false -ErrorAction SilentlyContinue
    } catch {}

    if (Test-Path $InstallPath) {
        Remove-Item -Path $InstallPath -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Log "HOLOCRON Probe uninstalled" -Level SUCCESS
}

function Get-ProbeStatus {
    try {
        $task = Get-ScheduledTask -TaskName $ServiceName -ErrorAction SilentlyContinue
        if ($task) {
            $info = Get-ScheduledTaskInfo -TaskName $ServiceName
            Write-Host ""
            Write-Host "  HOLOCRON Probe Status" -ForegroundColor Cyan
            Write-Host "  State:    $($task.State)" -ForegroundColor $(if ($task.State -eq "Running") { "Green" } else { "Yellow" })
            Write-Host "  Last Run: $($info.LastRunTime)"
            Write-Host "  Result:   $($info.LastTaskResult)"
            Write-Host ""
        } else {
            Write-Log "HOLOCRON Probe is not installed as a service" -Level WARN
        }
    } catch {
        Write-Log "Could not check status: $_" -Level ERROR
    }
}

function Test-Connection {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  HOLOCRON AI Probe - Diagnostics" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "[Step 1/5] Configuration" -ForegroundColor Yellow
    Write-Host "  API URL  : $ApiUrl"
    Write-Host "  Token    : $(if ($Token) { $Token.Substring(0, [Math]::Min(8, $Token.Length)) + '...' } else { '(not set!)' })"
    Write-Host ""

    if (-not $Token -or $Token -eq "") {
        Write-Host "  ERROR: No token provided! Use -Token parameter." -ForegroundColor Red
        Write-Host '  Example: .\holocron-probe.ps1 -Token "hcn_abc..." -ApiUrl "https://..." -Command Test' -ForegroundColor Gray
        return
    }
    if (-not $ApiUrl -or $ApiUrl -eq "http://localhost:5000") {
        Write-Host "  WARNING: ApiUrl is default/empty. Make sure to set the full Replit URL." -ForegroundColor Yellow
        Write-Host '  Example: -ApiUrl "https://your-app.replit.dev"' -ForegroundColor Gray
        Write-Host ""
    }

    Write-Host "[Step 2/5] System Info Collection" -ForegroundColor Yellow
    try {
        $myHostname = Get-SystemHostname
        Write-Host "  Hostname     : $myHostname" -ForegroundColor Green
    } catch { Write-Host "  Hostname     : FAILED - $_" -ForegroundColor Red }
    try {
        $myIp = Get-PrimaryIP
        Write-Host "  IP Address   : $myIp" -ForegroundColor Green
    } catch { Write-Host "  IP Address   : FAILED - $_" -ForegroundColor Red }
    try {
        $myOs = Get-OSInfo
        Write-Host "  OS           : $myOs" -ForegroundColor Green
    } catch { Write-Host "  OS           : FAILED - $_" -ForegroundColor Red }
    try {
        $myMac = Get-MacAddress
        Write-Host "  MAC Address  : $myMac" -ForegroundColor Green
    } catch { Write-Host "  MAC Address  : FAILED - $_" -ForegroundColor Red }
    try {
        $myMfr = Get-Manufacturer
        Write-Host "  Manufacturer : $myMfr" -ForegroundColor Green
    } catch { Write-Host "  Manufacturer : FAILED - $_" -ForegroundColor Red }
    try {
        $myModel = Get-ModelInfo
        Write-Host "  Model        : $myModel" -ForegroundColor Green
    } catch { Write-Host "  Model        : FAILED - $_" -ForegroundColor Red }
    try {
        $myCpu = Get-CpuInfoDetail
        Write-Host "  CPU          : $myCpu" -ForegroundColor Green
    } catch { Write-Host "  CPU          : FAILED - $_" -ForegroundColor Red }
    try {
        $myMem = Get-TotalMemoryGB
        Write-Host "  Memory       : $myMem GB" -ForegroundColor Green
    } catch { Write-Host "  Memory       : FAILED - $_" -ForegroundColor Red }
    try {
        $mySysType = Get-SystemTypeInfo
        Write-Host "  System Type  : $mySysType" -ForegroundColor Green
    } catch { Write-Host "  System Type  : FAILED - $_" -ForegroundColor Red }
    Write-Host ""

    Write-Host "[Step 3/5] DNS Resolution" -ForegroundColor Yellow
    try {
        $uri = [System.Uri]$ApiUrl
        $dns = [System.Net.Dns]::GetHostAddresses($uri.Host)
        Write-Host "  $($uri.Host) -> $($dns[0])" -ForegroundColor Green
    } catch {
        Write-Host "  DNS lookup FAILED for $ApiUrl" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
        Write-Host "  Check your internet connection and the URL." -ForegroundColor Yellow
        return
    }
    Write-Host ""

    Write-Host "[Step 4/5] HTTPS Connection" -ForegroundColor Yellow
    try {
        $testUrl = "$ApiUrl/api/health"
        Write-Host "  Testing: $testUrl"
        $response = Invoke-WebRequest -Uri $testUrl -Method GET -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
        Write-Host "  HTTP $($response.StatusCode) - Server is reachable!" -ForegroundColor Green
    } catch {
        $statusCode = $null
        try { $statusCode = $_.Exception.Response.StatusCode.value__ } catch {}
        if ($statusCode) {
            Write-Host "  HTTP $statusCode - Server responded (may not have /api/health route, that's OK)" -ForegroundColor Yellow
        } else {
            Write-Host "  Connection FAILED: $_" -ForegroundColor Red
            Write-Host "  Possible causes:" -ForegroundColor Yellow
            Write-Host "    - Firewall blocking outbound HTTPS (port 443)" -ForegroundColor Gray
            Write-Host "    - VPN interfering with connection" -ForegroundColor Gray
            Write-Host "    - URL is incorrect" -ForegroundColor Gray
            return
        }
    }
    Write-Host ""

    Write-Host "[Step 5/5] API Enrollment Test" -ForegroundColor Yellow
    Write-Host "  Sending test enrollment to /api/probe-enroll..."
    try {
        $body = @{
            siteToken      = $Token
            hostname       = $myHostname
            ipAddress      = $myIp
            osInfo         = $myOs
            probeVersion   = $ProbeVersion
            deploymentType = "bare-metal"
            macAddress     = $myMac
            manufacturer   = $myMfr
            model          = $myModel
            cpuInfo        = $myCpu
            totalMemoryGB  = $myMem
            systemType     = $mySysType
        }
        $jsonBody = $body | ConvertTo-Json -Depth 10
        Write-Host "  Request body:" -ForegroundColor Gray
        Write-Host "  $jsonBody" -ForegroundColor Gray
        Write-Host ""

        $result = Invoke-RestMethod -Uri "$ApiUrl/api/probe-enroll" -Method POST -ContentType "application/json" -Body $jsonBody -TimeoutSec 30
        Write-Host "  ENROLLMENT SUCCESSFUL!" -ForegroundColor Green
        Write-Host "  Probe ID: $($result.probeId)" -ForegroundColor Green
        Write-Host "  Response: $($result | ConvertTo-Json -Depth 5)" -ForegroundColor Gray
    } catch {
        $statusCode = $null
        $errorBody = ""
        try {
            $statusCode = $_.Exception.Response.StatusCode.value__
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $reader.Close()
        } catch {}

        if ($statusCode) {
            Write-Host "  FAILED - HTTP $statusCode" -ForegroundColor Red
            Write-Host "  Server response: $errorBody" -ForegroundColor Red
            if ($statusCode -eq 400) {
                Write-Host "  This usually means the token is invalid or expired." -ForegroundColor Yellow
                Write-Host "  Generate a new token in the Deploy dialog and try again." -ForegroundColor Yellow
            } elseif ($statusCode -eq 404) {
                Write-Host "  The enrollment endpoint was not found. Check the API URL." -ForegroundColor Yellow
            } elseif ($statusCode -eq 500) {
                Write-Host "  Server error. Check the HOLOCRON AI server logs." -ForegroundColor Yellow
            }
        } else {
            Write-Host "  FAILED - Could not reach server" -ForegroundColor Red
            Write-Host "  Error: $_" -ForegroundColor Red
        }
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Diagnostics Complete" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Show-Help {
    Write-Host ""
    Write-Host "HOLOCRON AI Probe Agent - Windows" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\holocron-probe.ps1 -Token <token> -ApiUrl <url> -Command <command>"
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  Start      Start the probe agent (foreground)"
    Write-Host "  Install    Install as a Windows scheduled task"
    Write-Host "  Uninstall  Remove the scheduled task"
    Write-Host "  Status     Check probe status"
    Write-Host "  Test       Test connection to HOLOCRON AI"
    Write-Host "  Help       Show this help"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host '  .\holocron-probe.ps1 -Token "hcn_abc123" -ApiUrl "https://your-instance.com" -Command Start'
    Write-Host '  .\holocron-probe.ps1 -Token "hcn_abc123" -ApiUrl "https://your-instance.com" -Command Install'
    Write-Host '  .\holocron-probe.ps1 -Command Status'
    Write-Host ""
}

switch ($Command) {
    "Help" {
        Show-Help
        return
    }
    "Status" {
        Get-ProbeStatus
        return
    }
    "Uninstall" {
        Uninstall-ProbeService
        return
    }
}

if (-not $Token) {
    Write-Host "Error: Site token is required." -ForegroundColor Red
    Write-Host 'Set $env:HOLOCRON_TOKEN or use -Token parameter.' -ForegroundColor Yellow
    Write-Host ""
    Show-Help
    return
}

if (-not $ApiUrl) {
    Write-Host "Error: API URL is required." -ForegroundColor Red
    Write-Host 'Set $env:HOLOCRON_API or use -ApiUrl parameter.' -ForegroundColor Yellow
    Write-Host ""
    Show-Help
    return
}

$ApiUrl = $ApiUrl.TrimEnd('/')

Write-Banner

switch ($Command) {
    "Start" {
        Write-Log "Starting HOLOCRON Probe Agent..."
        Write-Log "  Token: $($Token.Substring(0, [Math]::Min(10, $Token.Length)))...$($Token.Substring([Math]::Max(0, $Token.Length - 4)))"
        Write-Log "  API:   $ApiUrl"
        Write-Host ""

        if (Invoke-Enrollment) {
            Write-Log "Probe is online. Heartbeat interval: ${HeartbeatInterval}s" -Level SUCCESS
            Write-Host ""
            Start-ProbeDaemon
        } else {
            Write-Log "Failed to enroll. Check your token and API URL." -Level ERROR
        }
    }
    "Install" {
        Install-ProbeService
    }
    "Test" {
        Test-Connection
    }
}
