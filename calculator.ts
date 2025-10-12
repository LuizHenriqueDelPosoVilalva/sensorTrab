import * as grpc from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';

const packageDef = loadSync("./measurements.proto", {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = (grpc.loadPackageDefinition(packageDef) as any).measurements;

const STORAGE_ADDRESS = '10.0.0.173:50051';

const client = new proto.MeasurementService(
  STORAGE_ADDRESS,
  (grpc.credentials as any).createInsecure()
);

function waitReady(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + timeoutMs);
    client.waitForReady(deadline, (err: Error | null) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

interface Measurement {
  value: string | number;
  timestamp?: string;
  [key: string]: any;
}

interface Stats {
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

function calculateStats(data: Measurement[]): Stats {
  const values: number[] = data
    .map((d) => typeof d.value === 'string' ? Number(d.value) : d.value)
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));

  if (values.length === 0) return { count: 0, avg: null, min: null, max: null };

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function fetchRemoteMeasurements(callback: (measurements: Measurement[]) => void): void {
  const attempt = async (tries = 0) => {
    try {
      await waitReady(5000);
    } catch (err: any) {
      const backoff = Math.min(30000, 1000 * Math.pow(2, tries));
      console.warn(`[CALCULATOR] gRPC not ready, retrying in ${backoff}ms: ${err && err.message}`);
      setTimeout(() => attempt(tries + 1), backoff);
      return;
    }

    client.GetAll({}, (err2: Error | null, response: any) => {
      if (err2) {
        console.error('[CALCULATOR] gRPC GetAll error:', err2.message);
        return callback([]);
      }

      const list: Measurement[] = response && response.measurements ? response.measurements : [];
      callback(list);
    });
  };

  attempt(0);
}

function runCalculator(): void {
  console.log('[CALCULATOR] Solicitando medições via gRPC...');
  fetchRemoteMeasurements((data) => {
    const stats = calculateStats(data);
    console.log('[CALCULATOR] Estatísticas calculadas:');
    console.log(`- Total registros: ${stats.count}`);
    console.log(`- Valor médio: ${stats.avg}`);
    console.log(`- Valor mínimo: ${stats.min}`);
    console.log(`- Valor máximo: ${stats.max}`);
  });
}

setInterval(runCalculator, 5000);
runCalculator();

