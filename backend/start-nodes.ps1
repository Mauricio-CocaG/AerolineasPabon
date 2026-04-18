# Script para iniciar los 3 nodos de desarrollo
Write-Host "Iniciando los 3 nodos distribuidos..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Descargas\AerolineasPabon\rafael-pabon-airlines\backend'; $env:NODE_ID=1; $env:NODE_NAME='BOGOTA'; $env:PORT=3001; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Descargas\AerolineasPabon\rafael-pabon-airlines\backend'; $env:NODE_ID=2; $env:NODE_NAME='MADRID'; $env:PORT=3002; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Descargas\AerolineasPabon\rafael-pabon-airlines\backend'; $env:NODE_ID=3; $env:NODE_NAME='TOKIO'; $env:PORT=3003; npm run dev"

Write-Host "Nodos iniciados:" -ForegroundColor Yellow
Write-Host "  Nodo 1 (BOGOTA): http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Nodo 2 (MADRID): http://localhost:3002" -ForegroundColor Cyan
Write-Host "  Nodo 3 (TOKIO): http://localhost:3003" -ForegroundColor Cyan
