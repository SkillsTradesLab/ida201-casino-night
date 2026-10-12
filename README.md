# IDA201 Casino Night — Motor Mastery

A classroom casino quiz for **20 to 40 individual students**. The teacher hosts a shared table; all students see the same multiple-choice question and answer order on a teacher-authoritative 30-second clock.

## Teacher and student pages

Repository: `SkillsTradesLab/ida201-casino-night`

After GitHub Pages is enabled and deployment completes:

- Teacher portal: https://skillstradeslab.github.io/ida201-casino-night/teacher.html
- Student entrance: https://skillstradeslab.github.io/ida201-casino-night/
- Teaching lesson: https://skillstradeslab.github.io/ida201-casino-night/lesson.html
- Question bank and answer key: https://skillstradeslab.github.io/ida201-casino-night/question-bank.html

Enable Pages in Settings → Pages → Deploy from a branch → main → /(root) → Save. If using the downloadable package, upload the files inside the ZIP at the repository root and keep the vendor and tools folders intact.

## Classroom setup

1. Teach the 90-minute lesson before the game. The Word guide and online lesson contain a complete 120-minute class sequence, motor construction comparisons, applications, talking points, simple calculations, and checks with answers.
2. Open teacher.html. Choose 20, 24, 30, or 40 student seats. Default capacity is 24. The teacher does not occupy a student seat.
3. Choose chapters, skills, question sources, and hand count. Default rotation uses two motor questions for each circuitry question. Even rotation is available. Selecting only one chapter serves that chapter alone.
4. Default wager rule is Student chooses with a $100 minimum. Fixed $100 is also available.
5. Choose Live classroom, open the table, and use Copy student link. Students enter a name or initials; no ChatGPT account is needed.
6. Wait for the intended student seats to show Connected. Start the game. Let students lock wagers, then deal the question.
7. Explain each revealed answer, allow voluntary rescues, and select Next hand. Export results before closing the teacher tab.

## House rules

- $1,500 in virtual chips per student.
- Students choose wagers from $100 up to their balance in $50 steps, before seeing the question. Default mode is student choice. Wagers lock when submitted.
- The teacher's deal automatically commits $100 for each active seat that has not locked a wager. There is no fold option. Disconnected active seats also commit the default wager.
- A three-second cue precedes a shared **30-second** answer window. A submitted answer must reach the teacher before the deadline. First accepted answer locks; all students still get the full shared clock.
- Correct answers return the stake and pay an equal profit. Basic bonus $0, Applied bonus $50, Advanced bonus $100. Wrong answers and no accepted answer at the deadline lose the committed wager.
- Less than $100 means out until rescued. The student can continue watching.
- Between hands, a student can voluntarily transfer half of current net winnings above the original $1,500, rounded down to whole dollars. Current net winnings means current balance minus $1,500 after previous wins, losses, and gifts.
- A transfer must bring the recipient to at least $100, and leave the donor enough to play and fund any already locked wager. No new chips are created. Default allowance is one rescue received; teacher can choose two or three.
- The chosen hand limit ends the game. After the rescue window, fewer than two active students also ends play at Next hand. The teacher can end between hands.
- Highest final balance wins; correctness breaks a balance tie; an exact tie is shared. Wagers and gifts affect chips, so use accuracy and topic results to review learning rather than treating chip totals as grades.

## Question pool

| Source | Chapter 5 | Chapter 8 | Total |
| --- | ---: | ---: | ---: |
| Supplied IDA201 review converted to multiple choice | 38 | 40 | 78 |
| Previous classroom pool | 64 | 160 | 224 |
| New extra practice questions | 16 | 32 | 48 |
| **Total** | **118** | **232** | **350** |

Skills: **165 Basic, 109 Applied, 76 Advanced**. Some supplied review questions repeat concepts; all 78 are preserved and mapped to original item numbers. The previous pool includes 70 numerical practice forms with varied values. Question count is not a claim of 350 distinct concepts.

Use the question-source selector to serve the complete pool, supplied review only, previous questions only, or new questions only. The chapter and skill filters apply within that source. If fewer questions match than the chosen hand limit, the game reduces the limit to the available pool.

R5 and R8 IDs identify supplied review questions. X5 and X8 identify new questions. C5 and C8 identify previous questions. `review-question-map.csv` maps each uploaded review item to its new prompt and key. `SOURCE_NOTES.md` records corrections and source limitations.

The teacher browser prioritizes unseen questions within each selected chapter before reusing older ones. Motor-focus rotation uses two Chapter 8 questions per Chapter 5 question while those queues have questions. When a queue runs out, remaining questions from other selected chapters fill the deck. Each question ID appears once per game. Answers are shuffled once per hand and the same ordering is shared with everyone.

The new game uses separate browser storage and room identifiers from HVAC High Stakes, so its host state and replay history are independent of the previous game.

## Motor lesson

The lesson follows Chapter 5 review, then Chapter 8 magnetism, motor construction, shaded pole, split phase, capacitor start, PSC, CSR, three phase, ECM, constant torque, brushless controls, and simple calculations. It gives part descriptions and practical application examples, with a motor comparison chart and questions to ask before Casino Night.

Worked calculations cover synchronous speed, parallel and series capacitors, common/start/run resistance sums, and the chapter's capacitor substitution guide. They distinguish calculated synchronous field speed from actual loaded rotor speed. Exact specified capacitor values and manufacturer data take priority in equipment service.

## Technical operation and connection rehearsal

PeerJS 1.5.4 and its MIT license are bundled in vendor/. The live transport uses PeerJS Cloud signaling and browser WebRTC data connections. GitHub Pages serves the pages; it is not the multiplayer state server. The teacher tab hosts the authoritative state. Public signaling availability and school network policies affect connectivity.

The configured maximum is **40 students plus a teacher**. This is a software seat limit, not a guarantee of every school device or Wi-Fi network's performance. Rehearse the intended full roster on the actual school network. School firewalls or NAT can block peer connections; some networks require a signaling/TURN service not provisioned by this package. The browser must support WebRTC. Keep the teacher computer awake.

For same-computer tests, select the tab-test connection on both teacher and students. BroadcastChannel connects only tabs on the same origin and browser storage partition; it does not connect separate student devices. Fresh tabs need separate seat tokens. A copied game tab can share an existing token.

After a student disconnects, the same tab reconnects and recovers its seat; a new browser or private session does not have the original token. The teacher state is saved locally. Resume table in the same teacher browser can recover after a refresh if storage and connections remain available. There is no central database or cross-device teacher recovery.

Question keys are public repository files. This game is designed for classroom practice, not secure examinations. Original textbook PDFs and the supplied review DOCX are not included in the public repository.

## Edit and validate

Edit questions.json and run `node tools/sync-bank.cjs` to regenerate bank.js. Keep IDs unique and provide four unique answer choices, a valid key, explanation, source, chapter, level, and pool. Run `node tests/engine.test.cjs` for game-rule tests.

The browser rehearsal covers a teacher and 24 student seats, common question/answer order, chosen wagers, accepted answer locks, a full 30-second round, timeout loss, payout, rescue, CSV export, and responsive pages. Engine tests also cover the configured 40-seat limit. Separate-device school-network rehearsal remains required.
