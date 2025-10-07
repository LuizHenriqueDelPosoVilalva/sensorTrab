import net from "net";
import fs from "fs";
import path from "path";

const SENSOR_HOST = "127.0.0.1";
const SENSOR_PORT = 5000;

// Destino (Componente 3 - Armazenamento)
const STORAGE_HOST = "127.0.0.1";
const STORAGE_PORT = 6000;

// Opcional: manter cópia local (ativar com KEEP_LOCAL_COPY=true)
const KEEP_LOCAL_COPY =
  (process.env.KEEP_LOCAL_COPY || "false").toLowerCase() === "true";
const DATA_DIR = path.join(process.cwd(), "data");
if (KEEP_LOCAL_COPY && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_FILE = path.join(DATA_DIR, "measurements.jsonl");

// Conexão com o servidor de armazenamento (componente 3)
let storageSocket: net.Socket | null = null;
let storageBuffer: string[] = [];

function connectStorage() {
  if (storageSocket) return;

  const sock = net.createConnection(
    { host: STORAGE_HOST, port: STORAGE_PORT },
    () => {
      console.log(
        `[GATEWAY] Conectado ao storage em ${STORAGE_HOST}:${STORAGE_PORT}`
      );
      // Envia o que ficou pendente
      if (storageBuffer.length) {
        sock.write(storageBuffer.join("\n") + "\n");
        storageBuffer = [];
      }
    }
  );

  sock.on("error", (err) => {
    console.error(`[GATEWAY] Erro conexão storage: ${err.message}`);
  });

  sock.on("close", () => {
    console.warn(
      "[GATEWAY] Conexão com storage fechada. Tentando reconectar em 2s..."
    );
    storageSocket = null;
    setTimeout(connectStorage, 2000);
  });

  storageSocket = sock;
}

// Conectar ao sensor e pedir dados
function requestData() {
  const socket = net.createConnection(
    { host: SENSOR_HOST, port: SENSOR_PORT },
    () => {
      console.log(
        `[GATEWAY] Conectado ao sensor em ${SENSOR_HOST}:${SENSOR_PORT}`
      );
      socket.write("GET\n"); // envia requisição
    }
  );

  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString();

    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1); // remove a linha já processada

      if (!line) continue;

      try {
        const obj = JSON.parse(line);
        const outLine = JSON.stringify(obj);

        // Encaminha ao storage (componente 3)
        if (storageSocket && !storageSocket.destroyed) {
          storageSocket.write(outLine + "\n");
        } else {
          storageBuffer.push(outLine);
        }

        // Opcional: salva localmente também
        if (KEEP_LOCAL_COPY) {
          fs.appendFileSync(DB_FILE, outLine + "\n");
        }

        console.log(`[GATEWAY] Registro encaminhado:`, obj);
      } catch (e) {
        console.error("[GATEWAY] Erro parse:", e, "Linha recebida:", line);
      }
    }
  });

  socket.on("error", (err) => {
    console.error("[GATEWAY] Erro de conexão:", err.message);
  });
}

// Executa a cada X segundos
setInterval(requestData, 3000);
requestData();

// Estabelece conexão com o storage em paralelo
connectStorage();
