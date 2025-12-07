import net from "net";

const SENSOR_PORT = 5002;
const SENSOR_TYPES = ["temperature", "humidity", "heat_index"];
const SENSOR_ID = `${Math.floor(Math.random() * 1000)}`;
const CITY =  "Bairro-A";


// Função para gerar valor fake
function generateValue(type: String) {
  switch (type) {
    case "temperature": return { value: (20 + Math.random() * 10).toFixed(2), unit: "C" };
    case "humidity":    return { value: (40 + Math.random() * 40).toFixed(2), unit: "%" };
    case "heat_index":  return { value: (25 + Math.random() * 13).toFixed(2), unit: "C" };
    default:            return { value: "0", unit: "" };
  }
}

const server = net.createServer((socket) => {
  console.log(`[SENSOR ${SENSOR_ID}] Gateway conectado`);

  socket.on("data", (data) => {
    const req = data.toString().trim();

    if (req === "GET") {
      // Envia cada sensor separadamente
      SENSOR_TYPES.forEach((type) => {
        const { value, unit } = generateValue(type);
        const msg = {
          city: CITY,
          sensorId: `${type}-${SENSOR_ID}`,
          sensorType: type,
          value,
          unit,
          timestamp: new Date().toISOString(),
        };
        socket.write(JSON.stringify(msg) + "\n"); 
      });
    }
  });

  socket.on("end", () =>
    console.log(`[SENSOR ${SENSOR_ID}] Gateway desconectado`)
  );
});

server.listen(SENSOR_PORT, () => {
  console.log(`[SENSOR ${SENSOR_ID}] Servidor ouvindo na porta ${SENSOR_PORT}`);
});
