/* ═══════════════════════════════════════════════════════════════════════════
   DripBase — Main Application
   ═══════════════════════════════════════════════════════════════════════════ */

import { ethers } from "ethers";
import { DRIPBASE_ABI, CONFIG } from "./config.js";

// ─── State ──────────────────────────────────────────────────────────────────

let provider = null;
let signer = null;
let contract = null;
let connectedAddress = null;

let stats = {
  tips: 0,
  volume: 0n,
  wallets: new Set()
};

let allEvents = [];

// ─── DOM Refs ───────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);

const dom = {
  btnConnect: $("#btn-connect"),
  btnThemeToggle: $("#btn-theme-toggle"),
  networkBadge: $("#network-badge"),
  networkName: $("#network-name"),
  topbarTitle: $("#topbar-title"),

  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view-section"),

  statTips: $("#stat-tips"),
  statVolume: $("#stat-volume"),
  statWallets: $("#stat-wallets"),

  tipForm: $("#tip-form"),
  inputRecipient: $("#input-recipient"),
  inputAmount: $("#input-amount"),
  inputMessage: $("#input-message"),
  btnSend: $("#btn-send"),
  btnSendLabel: $("#btn-send-label"),
  btnSpinner: $("#btn-spinner"),

  txStatus: $("#tx-status"),
  txIcon: $("#tx-icon"),
  txText: $("#tx-text"),
  txLink: $("#tx-link"),

  feed: $("#feed"),
  feedEmpty: $("#feed-empty"),

  mytipsFeed: $("#mytips-feed"),
  mytipsEmpty: $("#mytips-empty"),

  leaderboardFeed: $("#leaderboard-feed"),
  leaderboardEmpty: $("#leaderboard-empty"),

  toastContainer: $("#toast-container"),
};

// ─── Navigation (SPA Routing) ───────────────────────────────────────────────

function initNavigation() {
  dom.navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Update Active State
      dom.navItems.forEach((n) => n.classList.remove("active"));
      item.classList.add("active");

      // Update Title
      dom.topbarTitle.textContent = item.textContent.trim();

      // Show View
      const targetId = item.getAttribute("data-target");
      dom.views.forEach((view) => {
        if (view.id === targetId) {
          view.classList.remove("hidden");
        } else {
          view.classList.add("hidden");
        }
      });

      // Trigger view specific logic
      if (targetId === "view-mytips") renderMyTips();
      if (targetId === "view-leaderboard") renderLeaderboard();
    });
  });
}

// ─── Wallet Connection ──────────────────────────────────────────────────────

async function connectWallet() {
  if (!window.ethereum) {
    toast("Install MetaMask to continue", "error");
    return;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    connectedAddress = accounts[0];

    await ensureNetwork();

    contract = new ethers.Contract(CONFIG.contractAddress, DRIPBASE_ABI, signer);

    updateWalletUI(true);
    enableForm();
    listenForTips();

    // Re-render my tips if user connected while on that tab
    renderMyTips();

    toast("Wallet connected!", "success");
  } catch (err) {
    console.error("Connection failed:", err);
    if (err.code === 4001) {
      toast("Connection rejected", "error");
    } else {
      toast("Connection failed — try again", "error");
    }
  }
}

function disconnectWallet() {
  provider = null;
  signer = null;
  contract = null;
  connectedAddress = null;
  updateWalletUI(false);
  disableForm();
  renderMyTips();
}

async function ensureNetwork() {
  const network = await provider.getNetwork();
  const currentChainId = Number(network.chainId);

  if (currentChainId !== CONFIG.chainId) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CONFIG.chainIdHex }],
      });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CONFIG.chainIdHex,
              chainName: CONFIG.chainName,
              rpcUrls: [CONFIG.rpcUrl],
              blockExplorerUrls: [CONFIG.blockExplorer],
              nativeCurrency: CONFIG.currency,
            },
          ],
        });
      } else {
        throw switchErr;
      }
    }
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
  }
}

// ─── ENS / Address Resolution ───────────────────────────────────────────────

async function resolveRecipient(input) {
  input = input.trim();
  if (ethers.isAddress(input)) return input;

  if (input.endsWith(".eth") || input.endsWith(".base.eth")) {
    try {
      const mainnetProvider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
      const resolved = await mainnetProvider.resolveName(input);
      if (resolved) {
        toast(`Resolved ${input} → ${shortenAddress(resolved)}`, "info");
        return resolved;
      }
    } catch (err) {
      console.warn("ENS resolution failed:", err.message);
    }
  }
  return null;
}

// ─── UI Updates ─────────────────────────────────────────────────────────────

function updateWalletUI(connected) {
  if (connected) {
    const short = shortenAddress(connectedAddress);
    dom.btnConnect.textContent = short;
    dom.btnConnect.classList.add("connected");
    dom.networkBadge.classList.add("connected");
    dom.networkName.textContent = CONFIG.chainName;
  } else {
    dom.btnConnect.textContent = "Connect Wallet";
    dom.btnConnect.classList.remove("connected");
    dom.networkBadge.classList.remove("connected");
    dom.networkName.textContent = "Not Connected";
  }
}

function updateStatsUI() {
  dom.statTips.textContent = stats.tips;
  dom.statVolume.textContent = parseFloat(ethers.formatEther(stats.volume)).toFixed(4);
  dom.statWallets.textContent = stats.wallets.size;
}

function enableForm() {
  dom.btnSend.disabled = false;
  dom.btnSendLabel.textContent = "Send Tip 💧";
}

function disableForm() {
  dom.btnSend.disabled = true;
  dom.btnSendLabel.textContent = "Connect Wallet to Tip";
}

function setLoading(loading) {
  dom.btnSend.disabled = loading;
  dom.btnSpinner.classList.toggle("hidden", !loading);
  dom.btnSendLabel.textContent = loading ? "Sending…" : "Send Tip 💧";
}

// ─── Quick Tip Amounts ──────────────────────────────────────────────────────

function initQuickAmounts() {
  const buttons = document.querySelectorAll(".quick-amount");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.inputAmount.value = btn.dataset.amount;
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  dom.inputAmount.addEventListener("input", () => {
    buttons.forEach((b) => b.classList.remove("active"));
  });
}

// ─── Send Tip ───────────────────────────────────────────────────────────────

async function handleTip(e) {
  e.preventDefault();
  if (!contract) return toast("Connect your wallet first", "error");

  const recipientInput = dom.inputRecipient.value.trim();
  const amountStr = dom.inputAmount.value.trim();
  const message = dom.inputMessage.value.trim();

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    toast("Enter a valid tip amount", "error");
    dom.inputAmount.focus();
    return;
  }

  setLoading(true);
  hideTxStatus();

  const recipient = await resolveRecipient(recipientInput);
  if (!recipient) {
    toast("Invalid address or ENS name could not be resolved", "error");
    setLoading(false);
    dom.inputRecipient.focus();
    return;
  }

  const value = ethers.parseEther(amountStr);

  try {
    const tx = await contract.tip(recipient, message, { value });
    showTxStatus("pending", "⏳", "Transaction submitted — waiting for confirmation…", tx.hash);
    const receipt = await tx.wait();
    showTxStatus("success", "✓", `Tipped ${amountStr} ETH successfully!`, receipt.hash);
    toast(`Sent ${amountStr} ETH! 💧`, "success");

    dom.inputRecipient.value = "";
    dom.inputAmount.value = "";
    dom.inputMessage.value = "";
    document.querySelectorAll(".quick-amount").forEach((b) => b.classList.remove("active"));
  } catch (err) {
    console.error("Tip failed:", err);
    if (err.code === "ACTION_REJECTED" || err.code === 4001) {
      toast("Transaction rejected", "error");
      hideTxStatus();
    } else {
      const reason = extractErrorMessage(err);
      showTxStatus("error", "✗", reason, null);
      toast(reason, "error");
    }
  } finally {
    setLoading(false);
  }
}

function showTxStatus(type, icon, text, txHash) {
  dom.txStatus.className = `tx-status ${type}`;
  dom.txIcon.textContent = icon;
  dom.txText.textContent = text;
  if (txHash) {
    dom.txLink.href = `${CONFIG.blockExplorer}/tx/${txHash}`;
    dom.txLink.classList.remove("hidden");
  } else {
    dom.txLink.classList.add("hidden");
  }
  dom.txStatus.classList.remove("hidden");
}

function hideTxStatus() {
  dom.txStatus.classList.add("hidden");
}

// ─── Live Feed & Views ──────────────────────────────────────────────────────

function listenForTips() {
  if (!contract) return;

  contract.on("TipSent", (sender, recipient, amount, message) => {
    stats.tips++;
    stats.volume += amount;
    stats.wallets.add(sender);
    stats.wallets.add(recipient);
    updateStatsUI();
    
    // Add to global events
    allEvents.push({ sender, recipient, amount, message });

    addFeedItem(sender, recipient, amount, message);
    
    // Auto refresh active views
    renderMyTips();
    renderLeaderboard();
  });

  loadRecentTips();
}

async function loadRecentTips() {
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 5000);

    const filter = contract.filters.TipSent();
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);

    allEvents = events.map(e => ({
      sender: e.args.sender,
      recipient: e.args.recipient,
      amount: e.args.amount,
      message: e.args.message
    }));

    // Calculate stats
    allEvents.forEach(ev => {
      stats.tips++;
      stats.volume += ev.amount;
      stats.wallets.add(ev.sender);
      stats.wallets.add(ev.recipient);
    });
    updateStatsUI();

    const recent = [...allEvents].slice(-20).reverse();

    if (recent.length > 0) {
      dom.feedEmpty.classList.add("hidden");
      for (const ev of recent) {
        addFeedItem(ev.sender, ev.recipient, ev.amount, ev.message, false);
      }
    }
    
    // Initial Render of background views
    renderMyTips();
    renderLeaderboard();
  } catch (err) {
    console.warn("Could not load past events:", err.message);
  }
}

function addFeedItem(sender, recipient, amount, message, animate = true) {
  dom.feedEmpty.classList.add("hidden");

  const amountEth = ethers.formatEther(amount);
  const avatarColor = addressToColor(sender);
  const item = document.createElement("div");
  item.className = "feed-item";
  if (!animate) item.style.animation = "none";

  item.innerHTML = `
    <div class="feed-item__header">
      <div class="feed-item__avatar" style="background:${avatarColor}">
        ${sender.slice(2, 4).toUpperCase()}
      </div>
      <span class="feed-item__sender">${shortenAddress(sender)}</span>
      <span class="feed-item__arrow">→</span>
      <span class="feed-item__recipient">${shortenAddress(recipient)}</span>
    </div>
    ${message ? `<div class="feed-item__body">"${escapeHtml(message)}"</div>` : ""}
    <div class="feed-item__footer">
      <span>Onchain</span>
      <span class="feed-item__amount">${parseFloat(amountEth).toFixed(4)} ETH</span>
    </div>
  `;

  dom.feed.insertBefore(item, dom.feedEmpty.nextSibling);

  const items = dom.feed.querySelectorAll(".feed-item");
  if (items.length > 30) {
    items[items.length - 1].remove();
  }
}

// ─── My Tips View ───

function renderMyTips() {
  if (!connectedAddress) {
    dom.mytipsFeed.innerHTML = `<div class="feed__empty" id="mytips-empty">Connect your wallet to see your history.</div>`;
    return;
  }

  const myEvents = allEvents.filter(ev => 
    ev.sender.toLowerCase() === connectedAddress.toLowerCase() || 
    ev.recipient.toLowerCase() === connectedAddress.toLowerCase()
  ).reverse();

  if (myEvents.length === 0) {
    dom.mytipsFeed.innerHTML = `<div class="feed__empty">You haven't sent or received any tips recently.</div>`;
    return;
  }

  let html = "";
  myEvents.forEach(ev => {
    const isSender = ev.sender.toLowerCase() === connectedAddress.toLowerCase();
    const typeLabel = isSender ? "Sent" : "Received";
    const amountEth = ethers.formatEther(ev.amount);
    const color = isSender ? "var(--error)" : "var(--success)";
    const sign = isSender ? "-" : "+";
    
    html += `
      <div class="feed-item">
        <div class="feed-item__header" style="justify-content: space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="feed-item__sender">${isSender ? "You" : shortenAddress(ev.sender)}</span>
            <span class="feed-item__arrow">→</span>
            <span class="feed-item__recipient">${!isSender ? "You" : shortenAddress(ev.recipient)}</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${typeLabel}</span>
        </div>
        ${ev.message ? `<div class="feed-item__body">"${escapeHtml(ev.message)}"</div>` : ""}
        <div class="feed-item__footer">
          <span>Onchain</span>
          <span class="feed-item__amount" style="color: ${color}">${sign}${parseFloat(amountEth).toFixed(4)} ETH</span>
        </div>
      </div>
    `;
  });

  dom.mytipsFeed.innerHTML = html;
}

// ─── Leaderboard View ───

function renderLeaderboard() {
  if (allEvents.length === 0) {
    dom.leaderboardFeed.innerHTML = `<div class="feed__empty">No tips found in recent blocks.</div>`;
    return;
  }

  const aggregated = {};
  allEvents.forEach(ev => {
    const addr = ev.sender.toLowerCase();
    if (!aggregated[addr]) {
      aggregated[addr] = { address: ev.sender, volume: 0n, count: 0 };
    }
    aggregated[addr].volume += ev.amount;
    aggregated[addr].count++;
  });

  const sorted = Object.values(aggregated).sort((a, b) => {
    if (a.volume > b.volume) return -1;
    if (a.volume < b.volume) return 1;
    return 0;
  });

  let html = "";
  sorted.forEach((user, idx) => {
    const amountEth = ethers.formatEther(user.volume);
    const avatarColor = addressToColor(user.address);
    const rankColor = idx === 0 ? "#FCD34D" : idx === 1 ? "#D1D5DB" : idx === 2 ? "#B45309" : "var(--text-tertiary)";
    
    html += `
      <div class="feed-item" style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="font-size: 1.2rem; font-weight: bold; color: ${rankColor}; width: 24px; text-align: center;">
            #${idx + 1}
          </div>
          <div class="feed-item__avatar" style="background:${avatarColor}">
            ${user.address.slice(2, 4).toUpperCase()}
          </div>
          <div>
            <div class="feed-item__sender">${shortenAddress(user.address)}</div>
            <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">${user.count} Tips Sent</div>
          </div>
        </div>
        <div class="feed-item__amount" style="font-size: 1.1rem;">
          ${parseFloat(amountEth).toFixed(4)} ETH
        </div>
      </div>
    `;
  });

  dom.leaderboardFeed.innerHTML = html;
}

// ─── Toasts ─────────────────────────────────────────────────────────────────

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = message;
  dom.toastContainer.appendChild(el);

  setTimeout(() => {
    el.classList.add("removing");
    el.addEventListener("animationend", () => el.remove());
  }, 3500);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function addressToColor(addr) {
  const hue1 = parseInt(addr.slice(2, 6), 16) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1},70%,50%), hsl(${hue2},60%,45%))`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function extractErrorMessage(err) {
  if (err?.reason) return err.reason;
  if (err?.message?.includes("insufficient funds")) return "Insufficient ETH balance";
  if (err?.message?.includes("transfer failed")) return "Transfer to recipient failed";
  return "Transaction failed — please try again";
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

const savedTheme = localStorage.getItem("dripbase_theme");
if (savedTheme === "light") {
  document.body.classList.add("light-mode");
  updateThemeIcon(true);
}

dom.btnThemeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("dripbase_theme", isLight ? "light" : "dark");
  updateThemeIcon(isLight);
});

function updateThemeIcon(isLight) {
  if (isLight) {
    dom.btnThemeToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  } else {
    dom.btnThemeToggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
}

// ─── Event Listeners & Init ─────────────────────────────────────────────────

dom.btnConnect.addEventListener("click", () => {
  if (connectedAddress) {
    disconnectWallet();
  } else {
    connectWallet();
  }
});

dom.tipForm.addEventListener("submit", handleTip);

// Init SPA Routing
initNavigation();
initQuickAmounts();

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (accounts.length === 0) disconnectWallet();
    else window.location.reload();
  });
  window.ethereum.on("chainChanged", () => window.location.reload());
}
