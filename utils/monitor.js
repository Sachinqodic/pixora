import os from 'os';

/**
 * Display server status and system metrics
 * @param {number} port - The port number the server is running on
 */
export function displayServerStatus(port) {
  const cpuCount = os.cpus().length;
  const cpuUsage = calculateCPUUsage();
  const timestamp = new Date().toISOString();

  console.log('\n========================================');
  console.log('🚀 Server Status');
  console.log('========================================');
  console.log(`Status: Running`);
  console.log(`Port: ${port}`);
  console.log(`CPU Cores: ${cpuCount}`);
  console.log(`CPU Usage: ${cpuUsage.toFixed(2)}%`);
  console.log(`Timestamp: ${timestamp}`);
  console.log('========================================\n');
}

/**
 * Calculate current CPU usage percentage
 * @returns {number} CPU usage percentage
 */
function calculateCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - (100 * idle) / total;

  return usage;
}
