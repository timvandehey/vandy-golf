import { spawn } from 'bun';

const choices = [
  { name: 'Start Dev Stack', cmd: 'bun run dev', desc: 'Starts both Vite frontend and mock dev-server concurrently for local testing.' },
  { name: 'Build Client App', cmd: 'bun run build', desc: 'Bundles frontend static files into the dist/ directory.' },
  { name: 'Deploy Client (Production)', cmd: 'bun run deploy:prod', desc: 'Builds and deploys the frontend web app to Cloudflare Pages production.' },
  { name: 'Deploy Client (Beta)', cmd: 'bun run deploy:dev', desc: 'Builds and deploys the frontend web app to Cloudflare Pages beta branch.' },
  { name: 'Run Headless Server Locally', cmd: 'bun run server', desc: 'Launches the headless SQLite server locally on port 8080.' },
  { name: 'Exit', cmd: null, desc: 'Exit the menu.' }
];

let selectedIndex = 0;

function drawMenu() {
  console.clear();
  console.log(`\x1b[1m\x1b[32m============================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[32m           GOLF TRACKER TASK COMMAND TUI MENU               \x1b[0m`);
  console.log(`\x1b[1m\x1b[32m============================================================\x1b[0m\n`);
  console.log(`Use \x1b[1mArrow Keys (Up/Down)\x1b[0m to select, and press \x1b[1mEnter\x1b[0m to run:\n`);

  choices.forEach((choice, index) => {
    const isSelected = index === selectedIndex;
    const formattedIndex = `[${(index + 1).toString().padStart(2)}]`;
    const cmdDisplay = choice.cmd || 'Exit';

    if (isSelected) {
      console.log(` \x1b[1m\x1b[32m➔ ${formattedIndex} ${choice.name.padEnd(30)}\x1b[0m \x1b[90m(${cmdDisplay})\x1b[0m`);
    } else {
      console.log(`     ${formattedIndex} ${choice.name.padEnd(30)} \x1b[90m(${cmdDisplay})\x1b[0m`);
    }
  });

  console.log(`\n\x1b[1m\x1b[32m------------------------------------------------------------\x1b[0m`);
  console.log(`\x1b[1mDescription:\x1b[0m`);
  console.log(`  \x1b[33m${choices[selectedIndex].desc}\x1b[0m`);
  console.log(`\x1b[1m\x1b[32m============================================================\x1b[0m\n`);
}

let isRunningCommand = false;
let isWaitingForReturn = false;

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdout.write('\u001b[?25l'); // Hide cursor

drawMenu();

process.stdin.on('data', async (key) => {
  if (isRunningCommand) return;

  if (isWaitingForReturn) {
    isWaitingForReturn = false;
    drawMenu();
    process.stdout.write('\u001b[?25l');
    return;
  }

  if (key === '\u0003' || key === '\u001b') {
    cleanupAndExit();
  }

  if (key === '\u001b[A') {
    selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
    drawMenu();
  }

  if (key === '\u001b[B') {
    selectedIndex = (selectedIndex + 1) % choices.length;
    drawMenu();
  }

  if (key === '\r' || key === '\n') {
    const choice = choices[selectedIndex];
    if (!choice.cmd) {
      cleanupAndExit();
    }

    process.stdin.setRawMode(false);
    process.stdout.write('\u001b[?25h');
    console.clear();

    const cmdToRun = choice.cmd;
    isRunningCommand = true;
    process.stdin.pause();
    console.log(`\x1b[1m\x1b[32m[Running] ${cmdToRun}...\x1b[0m\n`);

    const parts = cmdToRun.split(' ');
    const child = spawn(parts, { stdout: 'inherit', stderr: 'inherit', stdin: 'inherit' });
    await child.exited;

    console.log(`\n\x1b[1m\x1b[32mPress any key to return to menu...\x1b[0m`);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    isRunningCommand = false;
    isWaitingForReturn = true;
  }
});

function cleanupAndExit() {
  process.stdout.write('\u001b[?25h');
  console.clear();
  process.exit(0);
}
