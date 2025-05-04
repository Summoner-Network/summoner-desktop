// renderer/features/hosting/button_open_router.js
const { exec } = require('child_process');
const { shell } = require('electron');

// list of common LAN router IPs
const commonIPs = [
  "192.168.1.1",  "192.168.0.1",
  "10.0.0.1",     "172.16.1.1",
  "192.168.1.254","192.168.0.254",
  "10.0.1.1",     "172.16.0.1"
];

// ping an IP once, resolve true if we got a response
function ping(ip) {
  return new Promise(resolve => {
    exec(`ping -c1 -W1 ${ip}`, (err, stdout, stderr) => {
      resolve(!err);  // no error → reachable
    });
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
  alert("Could not detect any reachable router IP.");
}

// expose for require(…)  
module.exports = openRouter;
