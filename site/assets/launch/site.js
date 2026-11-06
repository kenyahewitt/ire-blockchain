const guides = {
  wallet: [
    "Meet your wallet",
    '<p>A self-custody wallet keeps signing keys on your device. Your public IRE address is safe to share. Your recovery phrase unlocks your funds and must stay private.</p><ol><li>Get a wallet extension from its official source, such as <a href="https://www.keplr.app/get" target="_blank" rel="noopener">Keplr</a>.</li><li>Create and back up your wallet locally. This website never asks for your recovery phrase.</li><li>IRE is a separate public testnet. Follow the <a href="/join/">network guide</a> before adding its configuration.</li><li>There is no public faucet or enabled Buy IRE checkout. Public First Light minting is still being verified.</li></ol>',
  ],
  paths: [
    "Choose your next move",
    '<ul><li><strong>Art lovers.</strong> Explore First Light below and download an artwork.</li><li><strong>Artists and builders.</strong> Read the <a href="/whitepaper/">whitepaper</a> and <a href="https://github.com/kenyahewitt/ire-blockchain">source code</a> to understand what the chain supports.</li><li><strong>Node operators.</strong> Open the <a href="/join/">validator guide and video</a>. You need a synced node and testnet uire for self-delegation and fees.</li><li><strong>Community.</strong> Share feedback in <a href="https://github.com/kenyahewitt/ire-blockchain/issues">GitHub issues</a>.</li></ul>',
  ],
  limits: [
    "Know the current limits",
    "<p>IRE is an experimental public testnet with one active validator. Its availability depends on that operator. It has no external security audit or proven mainnet economics.</p><p>All 500 First Light artworks and metadata were checked on-chain. Public browser minting and atomic marketplace settlement are still being verified. Bridge liquidity, real-asset redemption, and Buy IRE payments are unavailable.</p><p>Test assets have no promised cash value. This site offers no yield or return guarantee.</p>",
  ],
};
const dialog = document.querySelector("#guide");
document.querySelectorAll("[data-guide]").forEach((button) =>
  button.addEventListener("click", () => {
    const [title, html] = guides[button.dataset.guide];
    document.querySelector("#guide-title").textContent = title;
    document.querySelector("#guide-content").innerHTML = html;
    dialog.showModal();
  }),
);
dialog.querySelector(".close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  }
});
const editions = [1, 125, 250, 375, 500];
let position = 0;
function showEdition(delta) {
  position = (position + delta + editions.length) % editions.length;
  const id = editions[position],
    padded = String(id).padStart(3, "0");
  document.querySelector("#art").src = "/assets/launch/art-" + id + ".svg";
  document.querySelector("#art").alt = "First Light edition " + id;
  document.querySelector("#art-name").textContent = "First Light #" + padded;
  document.querySelector("#edition").textContent = padded + " / 500";
  document.querySelector("#art-download").href =
    "/assets/launch/art-" + id + ".svg";
}
document
  .querySelector("#previous")
  .addEventListener("click", () => showEdition(-1));
document.querySelector("#next").addEventListener("click", () => showEdition(1));
