# Dealing with File Locks - Windows/WSL Guide

## The Problem
When serving files with a web server (http-server, Python, etc.), Windows locks those files. This prevents:
- Deleting the dist/ folder
- Overwriting index.html
- Updating JavaScript bundles
- Unzipping over existing files

## Quick Solutions

### 1. Always Stop Servers Before Building
```bash
# Stop the server with Ctrl+C
# THEN run build
./build.sh
```

### 2. Use the Clean Build Script
```bash
# Automatically kills servers and cleans locked files
./clean-build.sh

# On Windows Command Prompt:
clean-build.bat
```

### 3. Force Clean with NPM
```bash
# Nuclear option - kills all servers and removes everything
npm run force-clean
npm run build
```

## Step-by-Step Recovery

If files are still locked:

### Option 1: Terminal Commands
```bash
# 1. Kill all Node/Python processes
pkill -f "http-server"
pkill -f "python"

# 2. Wait for file handles to release
sleep 3

# 3. Force remove
rm -rf dist test-deploy

# 4. Rebuild
./build.sh
```

### Option 2: Windows Task Manager
1. Open Task Manager (Ctrl+Shift+Esc)
2. Look for:
   - node.exe
   - python.exe
   - Windows Terminal
3. End these processes
4. Try building again

### Option 3: Windows Command (Run as Admin)
```cmd
# Find and kill processes using the files
taskkill /F /IM node.exe
taskkill /F /IM python.exe

# Force delete
rmdir /s /q dist
rmdir /s /q test-deploy
```

## Prevention Tips

### 1. Always use clean-build for updates
```bash
./clean-build.sh  # Instead of ./build.sh
```

### 2. Create an alias
Add to your .bashrc or .zshrc:
```bash
alias rebuild='pkill -f http-server; ./clean-build.sh'
```

### 3. Use the serve scripts properly
```bash
# Start server
npm run serve

# ALWAYS stop with Ctrl+C before rebuilding
# Don't use Ctrl+Z (suspends but doesn't stop)
```

## Emergency Reset

If nothing else works:

1. **Close all terminals**
2. **Restart Windows Terminal/WSL**
3. **Run as Administrator:**
```bash
# In elevated WSL
sudo rm -rf dist test-deploy .parcel-cache
```

4. **Or restart WSL entirely:**
```cmd
# In Windows CMD as Admin
wsl --shutdown
# Then reopen WSL
```

## Build Workflow Best Practice

```bash
# 1. Make your changes to curriculum.json or code

# 2. Stop any running servers (Ctrl+C)

# 3. Clean build
./clean-build.sh

# 4. Start server
npm run serve

# 5. Test at http://localhost:8080/dist/

# Repeat as needed - always stop server first!
```

## Common Lock Messages and Solutions

| Error | Solution |
|-------|----------|
| "Cannot remove dist: Directory not empty" | Server still running - use Ctrl+C |
| "Permission denied" | Use sudo or run as admin |
| "Resource busy or locked" | Close file explorer windows showing these folders |
| "Access is denied" | Windows Defender scanning - wait or add exclusion |

## Quick Commands Reference

```bash
# Clean everything and rebuild
npm run clean-build

# Just clean (no build)
npm run clean

# Force clean (kills processes)
npm run force-clean

# Normal build (after manual clean)
./build.sh

# Serve the app
npm run serve
```

Remember: **Always stop servers before building!** This will save you 90% of file lock headaches.