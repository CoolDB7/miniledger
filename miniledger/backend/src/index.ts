import { app } from "./app";
import { config } from "./config";

// 0.0.0.0 so a phone on the same Wi-Fi can reach it
app.listen(config.port, "0.0.0.0", () => console.log(`MiniLedger API on http://localhost:${config.port}`));
