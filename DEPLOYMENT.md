# AP Statistics PoK Blockchain - Deployment Guide

## Quick Start

1. **Build the application**
   ```bash
   ./build.sh
   ```
   This creates `app.zip` (404KB) containing everything needed.

2. **Deploy to device**
   - Transfer `app.zip` via USB or local network
   - Unzip to any folder
   - Open `dist/index.html` in Chrome/Edge

## Netbook Testing Protocol

### Setup (2 minutes)
1. Copy `app.zip` to netbook
2. Extract to `C:\APStats\` or similar
3. Open `dist/index.html` in browser
4. Verify loads in <3 seconds

### Functionality Tests
- [ ] Create profile with seed phrase
- [ ] Load questions from assets folder
- [ ] Submit MCQ attestation
- [ ] Submit FRQ attestation (1-5 score)
- [ ] View consensus distributions
- [ ] Generate QR code for sync
- [ ] Works fully offline

### Performance Checks
- Page load: <3 seconds
- Memory usage: <100MB
- Smooth scrolling/interactions
- QR code generation: <1 second

## Classroom Deployment (2-3 Students)

### Phase 1: Setup (5 minutes)
1. Each student opens app on their device
2. Create unique profiles
3. Record seed phrases securely
4. Verify different public keys

### Phase 2: Attestations (10 minutes)
Students complete:
- 2-3 MCQ questions
- 1-2 FRQ questions with scoring
- Monitor consensus emergence

### Phase 3: Sync Test (5 minutes)
1. Student A: Click "Sync" → "Generate QR"
2. Student B: Click "Sync" → "Scan QR"
3. Verify blockchain merge
4. Check reputation updates
5. Repeat with Student C

### Expected Results
- 90%+ sync success rate
- Consensus visible after 3+ attestations
- Reputation scores update correctly
- No data loss during sync

## Troubleshooting

### Common Issues

**App won't load**
- Check file paths are correct
- Ensure index.html opens from dist/ folder
- Try different browser (Chrome recommended)

**QR code won't scan**
- Increase screen brightness
- Reduce distance between devices
- Ensure camera permissions granted

**Sync fails**
- Check both devices have same version
- Verify QR code fully visible
- Try regenerating QR code

**Questions don't load**
- Verify assets/ folder is present
- Check curriculum.json exists
- Console for loading errors

## Technical Details

### File Structure
```
app.zip/
├── dist/
│   ├── index.html (entry point)
│   └── *.js (bundled code)
└── assets/
    ├── curriculum.json (questions)
    └── allUnitsData.js (legacy data)
```

### Browser Requirements
- Chrome 90+ or Edge 90+
- IndexedDB support
- Camera access (for QR scanning)
- 50MB+ free storage

### Offline Operation
- All features work without internet
- Data persists in IndexedDB
- Sync via QR codes only
- No external dependencies

## Iteration Workflow

### Bug Reporting
Document with:
1. Error message/screenshot
2. Steps to reproduce
3. Device/browser info
4. Expected vs actual behavior

### Quick Fixes
1. Edit source in src/
2. Run `./build.sh`
3. Test in test-deploy/
4. Redistribute app.zip

### Enhancement Pipeline
- **Immediate**: Fix critical bugs
- **Short-term**: UI improvements
- **Medium-term**: IPFS integration (if WiFi)
- **Long-term**: Teacher dashboard

## Performance Metrics

### Success Criteria
- **Technical**: All 58 atoms functional
- **Size**: <10MB package (currently 404KB ✓)
- **Speed**: <3s load time ✓
- **Scale**: 30+ students supported

### Monitoring
- Check console for errors
- Monitor memory in DevTools
- Time sync operations
- Track consensus convergence

## Contact & Support

For issues or questions:
1. Check this guide first
2. Review console errors
3. Test with simple case
4. Document and report

Build Version: Phase 6 (Post-invariants)
Last Updated: 2025-09-08