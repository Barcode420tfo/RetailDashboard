import { initializeTargetRegister } from './services/target-register.js';
import { initializeAuth } from './routes/auth.js';
import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './db.js';

// Validate configuration before opening a database connection or creating indexes.
import { validateConfiguration } from './configuration.js';
const { port, host } = validateConfiguration(process.env);

try {
  await connectDatabase();
  await initializeTargetRegister();
  await initializeAuth();
} catch (error) {
  // Driver errors may contain connection details. Keep credentials out of logs.
  const message = error.message?.startsWith('Private target reference missing.')
    || error.message?.startsWith('Set ADMIN_SETUP_CODE')
    ? error.message
    : 'Database initialization failed. Check Atlas credentials, network access, connectivity and indexes.';
  console.error(JSON.stringify({ level: 'error', stage: 'startup', errorType: error.name, message }));
  await disconnectDatabase();
  process.exit(1);
}

// Start API server
const server = app.listen(port, host, () => {
  console.log(`API listening on ${host}:${port}`);
});

// Handle server errors
server.on('error', async (error) => {
  console.error(error.message);
  await disconnectDatabase();
  process.exit(1);
});

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
  });
}