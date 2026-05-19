# Cat Clicker — Boredom Cure 🐱

Welcome to **Cat Clicker**, a relaxing (at least that what we're hoping for, i mean i'm sorry because it's fully created by AI, so some features might not work as expected :v but i hope u enjoy it) and engaging incremental/idle game built specifically to cure boredom. Whether you need a quick distraction or a cozy game to leave running in the background, Cat Clicker provides a charming experience with soothing synthesized audio, cute emojis, and satisfying progression.

## 📖 Background

Sometimes, you just need a break. This project was created as a lightweight, zero-dependency browser game to help users unwind. By combining simple clicker mechanics with unlockable ambient soundtracks and cosmetic skins, the game transforms from a repetitive task into a cozy desktop companion. 

## ✨ Features & Functions

- **🐾 Incremental Clicking Mechanic**: Start by clicking the cat to earn "Purrs". Each click gives you purrs, accompanied by a dynamic bounce animation, floating text, and a synthesized "meow" sound.
- **🛒 Shop & Upgrades**: Spend your hard-earned purrs in the Shop to buy upgrades. 
  - **Click Multipliers**: Make your active clicks more powerful (e.g., *Soft Paws*, *Turbo Paws*).
  - **Passive Generators**: Automate your purr generation (e.g., *Sleeping Cat*, *Cat Café*).
- **🎶 Ambient Audio Player**: Relax to synthesized background audio generated (barely) entirely through the Web Audio API. Start with tracks like *Rainy Window* or *Cozy Fireplace*, and unlock premium tracks like *Ocean Waves* in the shop. The player includes volume control, track switching, and crossfading.
- **🏆 Milestone System**: Reach specific total-purr thresholds (100, 500, 10,000, etc.) to trigger a full-screen celebration overlay and unique synthesized milestone chimes. 
- **🎭 Unlockable Skins**: Completing milestones unlocks new cosmetic "skins" for your cat. Use the Skin Selector widget to swap your main clicker to a Sleepy Cat (😴), Playful Cat (🧶), Regal Cat (👑), and even Mythic Cats (🦄).
- **🌙 Offline Progress**: The game engine calculates the time you spent away and automatically awards you the passive purrs you earned while offline when you return.
- **💾 Auto-Saving**: Your progress, unlocked tracks, and active skin are seamlessly saved to your browser's `localStorage` every 30 seconds.
- **😎 Visual Polish**: Enjoy subtle UI flourishes like dynamic mood backgrounds (the screen gets warmer if you click fast enough!), occasional decorative cats walking across the screen, and responsive CSS styling.

## 🛠️ Technology Stack

This game is built with a focus on performance and simplicity, relying entirely on native browser APIs without heavy frontend frameworks:
- **Core**: Vanilla TypeScript (`strict` mode)
- **Styling**: Native CSS (utilizing CSS variables, Grid, and Flexbox)
- **Audio**: Web Audio API (Using `OscillatorNode` and `GainNode` to synthesize sounds dynamically instead of loading large MP3 files).
- **Build Tool**: Vite (for rapid development and bundling)
- **Testing**: Vitest (with `jsdom` and `fast-check` for property-based testing)

## 🚀 How to Run Locally

1. **Ensure you have Node.js installed.**
2. **Clone the repository and navigate to the project folder:**
   ```bash
   cd vibin_00_revou
   ```
3. **Install the dependencies:**
   ```bash
   npm install
   ```
4. **Start the development server:**
   ```bash
   npm run dev
   ```
5. **Open your browser:**
   Navigate to `http://localhost:5173/` (or the URL provided in your terminal) to start clicking!

## 🧪 Running Tests
To run the automated test suite:
```bash
npm run test
```
To run tests with a coverage report:
```bash
npm run test:coverage
```
## Some Notes
This was my first ever vibe coding project, and maybe some update will come soon...
