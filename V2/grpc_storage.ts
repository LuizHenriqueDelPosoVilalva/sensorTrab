import * as grpc from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import path from 'path';
import fs from 'fs';
import net from 'net';

const TCP_PORT = 5005;
const GRPC_PORT = 50051;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'measurements.jsonl');
const PROTO_PATH = path.join(__dirname, 'measurements.proto');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const packageDef = loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = (grpc.loadPackageDefinition(packageDef) as any).measurements;

const tcpServer = net.createServer((socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[STORAGE-TCP] Conexão de ${remote}`);

  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString();

    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;

      try {
        const obj = JSON.parse(line);
        fs.appendFile(DB_FILE, JSON.stringify(obj) + '\n', (err) => {
          if (err) console.error('[STORAGE-TCP] Erro ao salvar registro:', err.message);
        });
        console.log('[STORAGE-TCP] Registro salvo:', obj.sensorType || obj);
      } catch (e) {
        console.warn('[STORAGE-TCP] Linha inválida recebida, ignorando:', line);
      }
    }
  });

  socket.on('error', (err) => {
    console.error(`[STORAGE-TCP] Erro conexão ${remote}:`, err.message);
  });

  socket.on('end', () => {
    console.log(`[STORAGE-TCP] Conexão encerrada por ${remote}`);
  });
});

tcpServer.listen(TCP_PORT, () => {
  console.log(`[STORAGE-TCP] Servidor ouvindo na porta ${TCP_PORT}`);
});

const grpcServer = new grpc.Server();
grpcServer.addService(proto.MeasurementService.service, {
  GetAll: (_call: any, callback: any) => {
    const measurements: any[] = [];
    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8').trim();
        if (content.length) {
          const lines = content.split('\n').filter((l) => l.trim() !== '');
          for (const l of lines) {
            try {
              const obj = JSON.parse(l);
              measurements.push(obj);
            } catch (e) {
            }
          }
        }
      } catch (err) {
        console.error('[gRPC] Erro ao ler arquivo de dados:', (err as Error).message);
        return callback(null, { measurements: [] });
      }
    }

    callback(null, { measurements });
  },
});

const GRPC_ADDRESS = `0.0.0.0:${GRPC_PORT}`;
grpcServer.bindAsync(GRPC_ADDRESS, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('[gRPC] bind error:', err.message);
    return;
  }

  console.log(`[gRPC] Storage listening on ${GRPC_ADDRESS}`);
});

