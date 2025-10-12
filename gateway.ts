import net from "net";
import fs from "fs";
import path from "path";

const SENSOR_HOST = '10.0.0.173';
const SENSOR_PORT = 5002

const STORAGE_HOST = '10.0.0.173'
const STORAGE_PORT = 5005

const KEEP_LOCAL_COPY = ("false").toLowerCase() === "true";
const DATA_DIR = path.join(process.cwd(), "data");
if (KEEP_LOCAL_COPY && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_FILE = path.join(DATA_DIR, "measurements.jsonl");

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

function requestData() {
  const socket = net.createConnection(
    { host: SENSOR_HOST, port: SENSOR_PORT },
    () => {
      console.log(
        `[GATEWAY] Conectado ao sensor em ${SENSOR_HOST}:${SENSOR_PORT}`
      );
      socket.write("GET\n");
    }
  );

  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString();

    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);

      if (!line) continue;

      try {
        const obj = JSON.parse(line);
        const outLine = JSON.stringify(obj);

        if (storageSocket && !storageSocket.destroyed) {
          storageSocket.write(outLine + "\n");
        } else {
          storageBuffer.push(outLine);
        }

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

setInterval(requestData, 3000);
requestData();

connectStorage();
