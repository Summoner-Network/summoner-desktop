// renderer/features/hosting/button_open_router.js
const { spawn } = require('child_process');
const { shell } = require('electron');

// list of common LAN router IPs
const commonIPs = [
  "192.168.1.1",  "192.168.0.1",
  "10.0.0.1",     "172.16.1.1",
  "192.168.1.254","192.168.0.254",
  "10.0.1.1",     "172.16.0.1"
];

// ping an IP once, resolve true if we got a response
function ping(ip, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const child = spawn('ping', ['-c', '1', ip], { stdio: 'ignore' });
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      try { child.kill('SIGKILL'); } catch (_) {}
      resolve(ok);
    };

    child.on('error', () => finish(false));
    child.on('close', (code) => finish(code === 0));
    setTimeout(() => finish(false), timeoutMs);
  });
}

// Try each IP in sequence. First one that works, openExternal and stop.
async function openRouter() {
  for (const ip of commonIPs) {
    console.log(`Pinging ${ip}…`);
    const ok = await ping(ip);
    if (ok) {
      console.log(`✅ Router reachable at http://${ip}`);
      shell.openExternal(`http://${ip}`);
      return;
    }
  }

  // none succeeded
  console.error("❌ No reachable router IP found");
  showAlert("Could not detect any reachable router IP.");
}

// expose for require(…)
module.exports = openRouter;
