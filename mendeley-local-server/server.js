const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and massive JSON payloads (Mendeley libraries can be large)
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Retrieve active local IP addresses for mobile app Wi-Fi pairing
function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Filter out localhost loopback and keep IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ interface: name, address: iface.address });
      }
    }
  }
  return addresses;
}

// 1. API: Import references bulk from Firefox extension
app.post('/api/references/import', async (req, res) => {
  const { references } = req.body;
  if (!references || !Array.isArray(references)) {
    return res.status(400).json({ error: 'Payload must contain a "references" array.' });
  }

  try {
    const count = await db.saveReferences(references);
    console.log(`[Server] Success! Bulk imported ${count} references.`);
    res.json({ success: true, count, message: `Successfully imported ${count} references.` });
  } catch (err) {
    console.error('[Server] Import error:', err);
    res.status(500).json({ error: 'Failed to import references into database: ' + err.message });
  }
});

// 2. API: Retrieve all stored references
app.get('/api/references', async (req, res) => {
  try {
    const list = await db.getAllReferences();
    res.json({ success: true, count: list.length, references: list });
  } catch (err) {
    console.error('[Server] Retrieve error:', err);
    res.status(500).json({ error: 'Failed to query database: ' + err.message });
  }
});

// 3. API: Retrieve system status, counts, and IP endpoints for mobile syncing
app.get('/api/system/status', async (req, res) => {
  try {
    const list = await db.getAllReferences();
    const ips = getLocalIPAddresses();
    res.json({
      success: true,
      referencesCount: list.length,
      localIPs: ips,
      serverPort: PORT,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query system status: ' + err.message });
  }
});

// 4. API: Clear all reference records
app.delete('/api/references', async (req, res) => {
  try {
    await db.clearDatabase();
    console.log('[Server] Database successfully cleared.');
    res.json({ success: true, message: 'All local references have been deleted.' });
  } catch (err) {
    console.error('[Server] Clear error:', err);
    res.status(500).json({ error: 'Failed to wipe database: ' + err.message });
  }
});

// Listen on 0.0.0.0 to allow connections from other devices on the same local network
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n==================================================');
  console.log(`   📚 MENDELEY LOCAL SYNCHER ONLINE`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log('==================================================');
  console.log('   Sync your phone on the local Wi-Fi:');
  const ips = getLocalIPAddresses();
  if (ips.length === 0) {
    console.log('   ⚠️  No external IPv4 interface found. Connect your server to Wi-Fi.');
  } else {
    ips.forEach(ip => {
      console.log(`   📡 IP Address [${ip.interface}]: http://${ip.address}:${PORT}`);
    });
  }
  console.log('==================================================\n');
});
