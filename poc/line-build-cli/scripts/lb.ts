/**
 * Line Build PoC CLI (Cycle 1 stub).
 *
 * Run:
 *   npx tsx poc/line-build-cli/scripts/lb.ts --help
 */

// Keep Cycle 1 dependencies minimal: avoid requiring @types/node.
declare const process: {
  argv: string[];
  stdout: { write: (chunk: string) => void };
  exitCode?: number;
};

function printHelp() {
  // Keep this intentionally minimal for Cycle 1.
  process.stdout.write(
    [
      "Line Build PoC CLI",
      "",
      "Usage:",
      "  npx tsx poc/line-build-cli/scripts/lb.ts <command> [options]",
      "",
      "Commands:",
      "  --help, -h   Show help",
      "",
      "Notes:",
      "  Cycle 1 stub: core commands added in later tasks.",
      "",
    ].join("\n"),
  );
}

function main(argv: string[]) {
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    printHelp();
    process.exitCode = 0;
    return;
  }

  // Usage error (per shared_conventions.cli_output.exit_codes.3)
  printHelp();
  process.exitCode = 3;
}

main(process.argv.slice(2));

