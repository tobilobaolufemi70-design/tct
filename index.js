require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const P = require("pino");
const readline = require("readline");

const prefix = ".";
const usePairingCode = true; // change to false if you want QR only

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: P({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: "silent" }))
    },
    browser: ["TCT-X BOT", "Safari", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  // Pairing Code Login
  if (usePairingCode && !sock.authState?.creds?.registered) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question("Enter your WhatsApp number (e.g 2348012345678): ", async (number) => {
      const code = await sock.requestPairingCode(number);
      console.log(`\n🔥 Pairing Code: ${code}\n`);
      rl.close();
    });
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("✅ Bot Connected Successfully");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;

    const msg =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      "";

    if (!msg.startsWith(prefix)) return;

    const args = msg.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // MENU
    if (command === "menu") {
      await sock.sendMessage(m.key.remoteJid, {
        text: `
╭───「 TCT-X BOT 」
│ .menu
│ .ping
│ .ai
│ .joke
│ .truth
│ .dare
╰────────────
`
      });
    }

    // PING
    if (command === "ping") {
      await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong!" });
    }

    // SIMPLE AI
    if (command === "ai") {
      const question = args.join(" ");
      if (!question)
        return sock.sendMessage(m.key.remoteJid, {
          text: "Ask something."
        });

      await sock.sendMessage(m.key.remoteJid, {
        text: "🤖 AI Mode Enabled (connect OpenAI next)."
      });
    }

    // JOKE
    if (command === "joke") {
      await sock.sendMessage(m.key.remoteJid, {
        text:
          "😂 Why did the JavaScript developer leave? Because he didn’t get closure."
      });
    }
  });
}

startBot();
