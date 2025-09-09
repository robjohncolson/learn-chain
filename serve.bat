@echo off
echo Starting local server for AP Stats Blockchain...
echo.
echo Opening at http://localhost:8080
echo Press Ctrl+C to stop the server
echo.
cd test-deploy
python -m http.server 8080