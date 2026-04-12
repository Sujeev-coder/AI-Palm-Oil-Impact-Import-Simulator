# Start Node Backend
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server/index.js"
# Start Vite Frontend
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "client"

Write-Host "Services started! Frontend exposed on local vite port (usually 5173), Backend on 5000."
