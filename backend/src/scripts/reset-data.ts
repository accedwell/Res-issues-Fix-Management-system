// npm run reset-data — puts the sample data back, wiping any changes.
import "dotenv/config";
import { DATA_FILE, resetData } from "../store/db.js";
import { DEMO_PASSWORD } from "../store/seed.js";

resetData();
console.log(`Sample data written to ${DATA_FILE}`);
console.log(`Every sample account uses the password: ${DEMO_PASSWORD}`);
