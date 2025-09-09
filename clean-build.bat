@echo off
REM AP Statistics PoK Blockchain - Windows Clean Build Script
REM Handles file locks on Windows

echo ================================
echo AP Stats Blockchain Clean Builder
echo ================================
echo.

REM Step 0: Kill any running servers
echo Stopping any running servers...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul

REM Step 1: Force remove old directories
echo Cleaning old build files...

REM Force remove dist
if exist dist (
    rmdir /s /q dist 2>nul
    if exist dist (
        echo WARNING: Could not remove dist folder - may be locked
        echo Please close any programs using these files
        pause
        rmdir /s /q dist
    )
)

REM Force remove test-deploy
if exist test-deploy (
    rmdir /s /q test-deploy 2>nul
)

REM Remove other files
if exist app.zip del /f /q app.zip
if exist .parcel-cache rmdir /s /q .parcel-cache

REM Step 2: Create fresh directories
mkdir dist 2>nul
mkdir test-deploy 2>nul

REM Step 3: Build
echo Building production bundle...
call npm run typecheck
call npx parcel build src/index.html --public-url ./ --no-source-maps --dist-dir dist

REM Step 4: Copy assets
echo Copying assets...
xcopy /E /I /Y assets dist\assets

REM Step 5: Create zip
echo Creating app.zip...
powershell -command "Compress-Archive -Path dist\*, assets\* -DestinationPath app.zip -Force"

REM Step 6: Extract for testing
echo Setting up test deployment...
cd test-deploy
powershell -command "Expand-Archive -Path ..\app.zip -DestinationPath . -Force"
cd ..

REM Step 7: Done
echo.
echo ================================
echo Clean Build Complete!
echo ================================
echo.
echo To run the app:
echo   npm run serve
echo   Open: http://localhost:8080/dist/
echo.
echo Remember: Always stop servers (Ctrl+C) before rebuilding!
echo.
pause