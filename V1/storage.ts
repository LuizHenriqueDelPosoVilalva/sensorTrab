import net from "net";
import fs from "fs";
import path from "path";

const STORAGE_PORT = 6006;

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, "measurements.jsonl");

const server = net.createServer((socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[STORAGE] Conexão de ${remote}`);

  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString();

    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);

      if (!line) continue;

      if (line === "GET_ALL") {
        console.log("[STORAGE] Enviando todos os registros...");
        if (fs.existsSync(DB_FILE)) {
          const fileContent = fs.readFileSync(DB_FILE, "utf-8").trim();
          
          const lines = fileContent.split("\n").filter((l) => l.trim() !== "");
          for (const l of lines) {
            socket.write(l.trim() + "\n");
          }
        }
        socket.end();
        continue;
      }

      try {
        JSON.parse(line);
        fs.appendFileSync(DB_FILE, line + "\n");
        console.log(`[STORAGE] Registro salvo (${line.length}b)`);
      } catch (e) {
        console.error("[STORAGE] Linha inválida, ignorada:", line);
      }
    }
  });

  socket.on("error", (err) => {
    console.error(`[STORAGE] Erro conexão com ${remote}: ${err.message}`);
  });

  socket.on("end", () => {
    console.log(`[STORAGE] Conexão encerrada por ${remote}`);
  });
});

server.listen(STORAGE_PORT, () => {
  console.log(`[STORAGE] Servidor ouvindo na porta ${STORAGE_PORT}`);
});
