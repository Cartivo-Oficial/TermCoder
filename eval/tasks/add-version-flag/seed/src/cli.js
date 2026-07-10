const args = process.argv.slice(2);

export function run(argv) {
  if (argv.includes("--help")) return "usage: greet <name>";
  const name = argv[0] ?? "world";
  return `hello, ${name}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(run(args));
}
