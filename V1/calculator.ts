import net from "net";

const STORAGE_HOST: string = "172.23.129.103";
const STORAGE_PORT: number =6000;

// Tipo do dado esperado do sensor
interface Measurement {
  value: number;          
  timestamp?: string;
  [key: string]: any;   
}

// Tipo das estatísticas calculadas
interface Stats {
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

// Função para buscar dados do Storage
function fetchData(callback: (data: Measurement[]) => void): void {
  const client = net.createConnection(
    { host: STORAGE_HOST, port: STORAGE_PORT },
    () => client.write("GET_ALL\n")
  );

  let buffer = "";

  client.on("data", (data: Buffer) => {
    buffer += data.toString();
  });

  client.on("end", () => {
    const lines = buffer.trim().split("\n");
    const data: Measurement[] = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);

        // converte value para number
        if (typeof obj.value === "string") {
          obj.value = Number(obj.value);
        }

        if (!isNaN(obj.value)) {
          data.push(obj as Measurement);
        }
      } catch {
        // ignora linhas inválidas
      }
    }

    callback(data);
  });

  client.on("error", (err: Error) => {
    console.error("[CALCULATOR] Erro ao conectar ao Storage:", err.message);
    callback([]);
  });
}

// Função para calcular estatísticas
function calculateStats(data: Measurement[]): Stats {
  if (data.length === 0) return { count: 0, avg: null, min: null, max: null };

  const values: number[] = data
    .map((d) => d.value)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));

  if (values.length === 0) return { count: 0, avg: null, min: null, max: null };

  const sum = values.reduce((a, b) => a + b, 0);

  return {
    count: values.length,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

// Execução periódica
function runCalculator(): void {
  console.log("[CALCULATOR] Solicitando dados ao Storage...");
  fetchData((data) => {
    const stats = calculateStats(data);
    console.log("[CALCULATOR] Estatísticas calculadas:");
    console.log(`- Total registros: ${stats.count}`);
    console.log(`- Valor médio: ${stats.avg}`);
    console.log(`- Valor mínimo: ${stats.min}`);
    console.log(`- Valor máximo: ${stats.max}`);
  });
}

setInterval(runCalculator, 5000);
