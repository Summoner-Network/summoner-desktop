// renderer/features/hosting/button_open_router.js
async function openRouter() {
  try {
    const { success, ip } = await window.summoner.openRouter();
    if (!success) alert("Could not detect any reachable router IP.");
  } catch (e) {
    console.error(e);
    alert("Router detection failed.");
  }
}
module.exports = openRouter;
