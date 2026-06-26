import { createServer } from "./server";

const port = Number(process.env.PORT ?? 4096);

createServer().listen(port, () => {
  process.stdout.write(`termcoder server listening on http://localhost:${port}\n`);
  process.stdout.write(
    `  POST /sessions · GET /sessions · GET /sessions/:id · WS /sessions/:id/stream\n`,
  );
});
