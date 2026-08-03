param([string]$ServerKey = "7OMZqnIWMk6dAjBpOJQxygORAb5-kX1UOkEFWhaXZm6Q")

# Implements the same token encoding as benchmark/k6-scripts/utils.js
$alph = @{ '0'='Q';'1'='B';'2'='W';'3'='S';'4'='P';'5'='H';'6'='D';'7'='X';'8'='Z';'9'='U' }

function New-EvalToken {
    param([string]$Secret)
    $s  = $Secret.TrimEnd('=')
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

    $encode = {
        param([long]$n, [int]$len)
        $padded = $n.ToString().PadLeft($len, '0')
        $chars  = $padded.ToCharArray() | Select-Object -Last $len
        -join ($chars | ForEach-Object { $alph[$_.ToString()] })
    }

    $tsCode = & $encode $ts $ts.ToString().Length
    $pos    = [Math]::Max([Math]::Floor((Get-Random -Maximum $s.Length)), 2)

    "$(& $encode $pos 3)$(& $encode $tsCode.Length 2)$($s.Substring(0,$pos))$tsCode$($s.Substring($pos))"
}

$results = @()
foreach ($cfg in @(
    @{ Label = "West eval-server"; Port = 5100 },
    @{ Label = "East eval-server"; Port = 5101 }
)) {
    $tok = New-EvalToken -Secret $ServerKey
    $url = "ws://localhost:$($cfg.Port)/streaming?type=server&version=2&token=" + [Uri]::EscapeDataString($tok)
    $ws  = [System.Net.WebSockets.ClientWebSocket]::new()
    $cts = [System.Threading.CancellationTokenSource]::new(6000)
    try {
        $ws.ConnectAsync([Uri]$url, $cts.Token).Wait(6000) | Out-Null
        $stateAfterConnect = $ws.State
        Start-Sleep -Milliseconds 1500
        $stateAfterWait = $ws.State
        $ws.CloseAsync(
            [System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure,
            "done",
            [System.Threading.CancellationToken]::None
        ).Wait(3000) | Out-Null

        if ($stateAfterConnect -eq "Open" -and $stateAfterWait -eq "Open") {
            Write-Host "PASS  $($cfg.Label)  (port $($cfg.Port))  connected + stable for 1.5 s" -ForegroundColor Green
            $results += "PASS"
        }
        else {
            Write-Host "WARN  $($cfg.Label)  connect=$stateAfterConnect  after1.5s=$stateAfterWait" -ForegroundColor Yellow
            $results += "WARN"
        }
    }
    catch {
        $msg = $_.Exception.InnerException?.InnerException?.Message `
            ?? $_.Exception.InnerException?.Message `
            ?? $_.Exception.Message
        Write-Host "FAIL  $($cfg.Label)  $msg" -ForegroundColor Red
        $results += "FAIL"
    }
    finally {
        $ws.Dispose()
        $cts.Dispose()
    }
}

Write-Host ""
if ($results -notcontains "FAIL" -and $results -notcontains "WARN") {
    Write-Host "All WebSocket checks passed." -ForegroundColor Green
}
else {
    Write-Host "One or more checks failed." -ForegroundColor Red
}
