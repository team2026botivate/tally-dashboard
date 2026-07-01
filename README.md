# Enterprise TallyPrime Remote Data Gateway

A secure, production-grade integration system for connecting SaaS web applications to local TallyPrime installations running on remote client PCs. 

This repository implements the **Recommended SaaS Architecture**: TallyPrime's local XML Gateway is accessed via a lightweight local agent that tunnels data over an outbound-only WebSocket connection to a central cloud server. **No inbound ports, port-forwarding, or firewalls need to be configured on the client PC.**

---

## Project Structure

*   `/backend`: Node.js Express server acting as the cloud Gateway Controller & WebSocket RPC Server.
*   `/backend/src/agent`: Lightweight client-agent daemon designed to run on the Windows PC hosting Tally.
*   `/frontend`: React dashboard for viewing synced data and monitoring connected remote gateways.

---

## 1. Backend Server Setup

The backend handles API requests from the frontend dashboard, manages active WebSocket connections from remote PC agents, and handles all XML data parsing and transformation.

### Steps
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Set up the database:
   * Log into your **Supabase Dashboard** and make sure your project is active/resumed.
   * Verify your `.env` contains the correct `DATABASE_URL` and `DIRECT_URL`.
4. Apply the database schema migrations:
   ```bash
   npm run db:push
   ```
5. Configure your connection mode in `/backend/.env`:
   ```env
   # Backend Server Port
   PORT=3001
   
   # Tally Direct Connection Mode (Optional)
   # If you want to connect to a Tally instance directly via network IP:
   TALLY_HOST=localhost
   TALLY_PORT=9000
   TALLY_IS_REMOTE=false
   ```
6. Start the backend development server:
   ```bash
   npm run dev
   ```

---

## 2. Client Agent Setup (On Remote Tally PC)

The local agent connects to the cloud server via WebSocket and forwards XML payloads to the local Tally server.

### Prerequisites
*   Ensure TallyPrime (or TallyPrime Educational / Tally ERP 9) is running.
*   Verify Tally's local server capability is enabled (default port `9000`).

### Steps
1. Copy the `/backend/src/agent` folder to the target PC.
2. In the `agent` folder, create a `.env` file containing:
   ```env
   # Address of your cloud backend server
   GATEWAY_URL=http://localhost:3001
   
   # Credentials generated from the React Dashboard
   GATEWAY_ID=your-unique-gateway-client-id
   DEVICE_SECRET=your-secure-device-activation-secret
   
   # Local Tally connection details on this PC
   TALLY_HOST=localhost
   TALLY_PORT=9000
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the agent process:
   ```bash
   npm run start
   ```
   *The agent will log a success message once it establishes an outbound connection and sends a system heartbeat.*

---

## 3. Frontend Dashboard Setup

The React dashboard allows you to monitor connected client gateways, view logs, and trigger syncs.

### Steps
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

---

## 4. How Data Syncing Works

1.  **Auto-Discovery of Companies**:
    *   **Direct Mode**: On backend startup, the server automatically queries the configured `TALLY_HOST` directly, discovers all companies currently open in Tally, and seeds them in the database.
    *   **Remote Agent Mode**: Once the agent connects, a request to `/api/config/:configId/fetch-companies` queries the remote Tally instance via the active WebSocket connection and registers the found companies.
2.  **Report Pulling & Transformation**:
    *   Triggering a sync (such as `/api/tally/sync/full`) causes `TallyDataFetcher` to check if the active config is remote.
    *   If remote, the server tunnels the Tally XML query over the WebSocket. The agent replies with the raw XML output.
    *   The cloud server parses the XML using `fast-xml-parser` (handling all tag casing permutations to support various Tally versions) and upserts the records to your Supabase Postgres database.
