import { spawn } from "node:child_process";
import path from "node:path";

function run(command: string, args: string[], input: string): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 8000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout });
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

export async function settleThroughSchoolStack(body: unknown): Promise<{ status: number; json: unknown }> {
  const php = process.env.BALABET_PHP ?? path.join(process.cwd(), "school/bin/php");
  const script = path.join(process.cwd(), "school/php/settle.php");
  try {
    const result = await run(php, [script], JSON.stringify(body));
    const json = JSON.parse(result.stdout) as { ok?: boolean; code?: string };
    if (json.code === "validation") return { status: 400, json };
    if (!json.ok) return { status: 503, json };
    return { status: 200, json };
  } catch {
    return {
      status: 503,
      json: {
        ok: false,
        code: "engine_unavailable",
        error: "Motor PHP/Java indisponível.",
      },
    };
  }
}
