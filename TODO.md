### Step-by-Step Plan to Build the AP Statistics Consensus App

This plan breaks down the development into phases, leveraging your resources: Cursor for repo setup/scripts, Claude Opus (planner) and Sonnet (implementer) for targeted coding, Gemini for file-specific queries, and existing files (curriculum.json, quiz_renderer.html, allUnitsData.js). Assume you're working in a local dev environment (e.g., Node.js for JS/TS). Total estimated timeline: 4-6 weeks (part-time), with MVPs at key milestones.

#### Phase 1: Project Setup and Initialization (1-2 days)
1. **Initialize the Repo Using Cursor**:
   - Open Cursor (AI-VSCode fork).
   - Create a new folder: `ap-stats-consensus-app`.
   - Initialize Git: Run `git init` in terminal.
   - Add .gitignore: Use Cursor's AI to generate one for Node.js/JS projects (ignore node_modules, .env, dist).
   - Set up package.json: Use `npm init -y`; add dependencies via Cursor prompt: "Add scripts for build (Parcel), dev (live server), and test. Include dev deps: typescript, @types/node, parcel; runtime deps: idb, chart.js@3.9.1, mathjax, qrcode, html5-qrcode, lz-string, uuid, ecdsa (or use crypto.subtle)".
   - Create basic structure: Folders: src (JS/TS), assets (JSON files), dist (build output). Use Cursor AI: "Create tsconfig.json for ES6 modules, strict types".

2. **Import Existing Files**:
   - Copy curriculum.json and allUnitsData.js to assets/.
   - Copy quiz_renderer.html to src/ as quiz_renderer.ts (convert to module: Extract JS to separate file, make functions exportable).
   - Query Gemini: "Extract all exportable functions from quiz_renderer.html JS (e.g., renderQuestion, renderChart) and suggest TS types for them based on usage."

3. **Setup Project Management Script**:
   - In Cursor, create build.py or build.sh: Script to bundle (parcel build src/index.html --dist-dir dist), zip for distribution (zip -r app.zip dist assets), and test (open dist/index.html).
   - Add to package.json: "scripts": {"build": "parcel build", "dev": "parcel src/index.html"}.

#### Phase 2: Core Data and Blockchain Implementation (1 week)
Focus on FUNDAMENTAL.md atoms. Use Claude for this: Opus plans, Sonnet codes.

4. **Plan Blockchain Subsystem with Claude Opus**:
   - Prompt Opus: "Based on FUNDAMENTAL.md (paste full doc), plan Phase 1 atoms (Profile + basic Blockchain: data atoms like hash/prevHash/txType, functions like sha256Hash/validateSignature). Output: File structure (e.g., src/ledger.ts), interfaces (TS types), no code—just steps for Sonnet to implement. Align with spec: Local IndexedDB chain, simple PoW (hash starts with '00'), tx types CreateUser/Attestation."

5. **Implement Profile and Basic Blockchain with Claude Sonnet**:
   - Switch to Sonnet, provide Opus plan + spec snippet (e.g., Transaction interface).
   - Prompt: "Implement the plan: Create src/profile.ts (atoms: username/pubkey/privkey/etc., functions: deriveKeysFromSeed using crypto.subtle ECDSA, selectRandomWords from BIP39 wordlist preload). src/ledger.ts (Block/Transaction interfaces, addTransaction/mineBlock with low PoW, validateSignature). Use IndexedDB (idb lib) for persistence (save/load chain). Test stubs only."

6. **Add Consensus and Reputation Logic**:
   - Opus Prompt: "Plan Phase 2: Questions/Reputation atoms (e.g., updateDistributions, calculateConsensus with progressiveQuorum, reputationScore with bonuses/decay). Integrate curriculum.json schema (paste from Gemini answer). Functions for MCQ hash, FRQ scoring (1-5)."
   - Sonnet Prompt: "Implement plan: src/consensus.ts (calculateConsensus, updateDistributions for mcqDistribution/frqScores/convergence). src/reputation.ts (reputationScore calc with confidence/minorityBonus). Hook into ledger addTransaction."

7. **Query Gemini for Integration Details**:
   - Ask: "How to index curriculum.json by id into a Map for O(1) lookups? Provide TS code snippet. Also, extract rubric for FRQ attestation UI from solution.scoring."

#### Phase 3: UI and Navigation Integration (1 week)
Modify renderer for single-question mode; build lean UI.

8. **Plan UI with Claude Opus**:
   - Prompt: "Plan lean UI per spec (header/dashboard, single-question flow with video embed, attestation view). Extend quiz_renderer functions (e.g., hook submitCallback into renderQuestion). Virtual scrolling for performance (IntersectionObserver). No full code—file structure, event flows."

9. **Implement UI Basics with Claude Sonnet**:
   - Prompt: "Implement plan: src/index.ts (main entry, load curriculum/allUnitsData, init IndexedDB). src/ui.ts (dashboard tree from allUnitsData, header with reputation/progress/deadline). src/question.ts (loadVideo iframe, renderQuestion wrapper with inputs/submit, blind status). Use renderer funcs (renderPrompt/Choices/Chart/Solution). Add theme/audio toggles from renderer."

10. **Add Attestation and Consensus Display**:
    - Opus Prompt: "Plan attestation UI: Blind/reveal logic, side-by-side FRQ, charts for distributions (extend renderChart). Consensus post-attest (bar/histogram, top response)."
    - Sonnet Prompt: "Implement: In question.ts, post-submit reveal (fetch peer data from chain), voting inputs (score dropdown, confidence slider), create Attestation tx. Consensus charts via renderChart."

11. **Optimize Performance**:
    - Query Gemini: "Suggest TS code for virtual scrolling: Render buffer of 10 questions, use IntersectionObserver to lazy load Chart.js/MathJax per question."
    - Integrate into ui.ts via Sonnet.

#### Phase 4: Sync and QR Implementation (1 week)
QR for diffs; fallback USB.

12. **Plan Sync with Claude Opus**:
    - Prompt: "Plan QR sync per spec: Diff extraction (new tx since lastSync), compress/chunk/protocol (syncId/total/index/hash), multi-QR cycle display. Scan loop with html5-qrcode, merge (validate/union/recalc)."

13. **Implement Sync with Claude Sonnet**:
    - Prompt: "Implement src/sync.ts: generateQRDiff (qrcode.toCanvas, LZ.compressToBase64, chunk 1.5KB), display cycle. scanQR (html5-qrcode.start, collect/verify/reassemble/merge into ledger). UI modal in ui.ts (Share/Scan buttons, success message/tone)."

14. **Query Gemini for Renderer Hooks**:
    - Ask: "How to add custom callbacks to renderQuestion (e.g., onSubmit)? Suggest mods to quiz_renderer JS for export."

#### Phase 5: Testing, Error Handling, and Polish (1 week)
15. **Add Error Handling**:
    - Opus Prompt: "Plan errors: Alerts for invalid scan/signature/quorum (showMessage from renderer). Invariants checks in functions."
    - Sonnet Implement: Integrate into ledger/sync/ui.

16. **Test Locally**:
    - Use Cursor: Run `npm run dev`, test profile creation, question flow, local tx, consensus update.
    - Simulate Sync: Two browser instances, generate/scan QR manually.
    - Query Gemini: "Generate sample curriculum subset (5 questions: 3 MCQ, 2 FRQ) for testing."

17. **Anti-Gaming and AP Reveals**:
    - Sonnet Prompt: "Add rate limiting (30 days/question via timestamp check), outlier detection (>2 stdDev), AP reveal post-50% convergence (anonymousSignature, hint from answerKey)."

#### Phase 6: Deployment and Iteration (Ongoing)
18. **Build and Distribute**:
    - Run build script: Parcel to dist/, ZIP with assets.
    - Test on Netbook: Copy ZIP, unzip, open index.html via file://.
    - Class Test: 2-3 students, manual QR sync, gather feedback.

19. **Iterate with Resources**:
    - For bugs: Query Gemini on schema/funcs.
    - Enhancements: Opus plan (e.g., IPFS if WiFi improves), Sonnet code.
    - Milestone Checks: After each phase, verify against spec/invariants (e.g., load/save chain integrity).

Track progress in Cursor (e.g., TODO.md). If stuck, use tools here (e.g., web_search "ECDSA JS tutorial" for key gen). This gets to MVP; expand atoms as needed.