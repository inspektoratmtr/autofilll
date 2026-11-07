<script lang="ts">
  import { onMount } from "svelte";
  import { loadData, saveData, getActiveProfileId, setActiveProfileId } from "../storage/chrome-storage";
  import { DEFAULT_PROFILE_ID } from "../shared/constants";
  import type { Profile, AutofillRule } from "../shared/types";

  let profiles = $state<Profile[]>([]);
  let rules = $state<AutofillRule[]>([]);
  let selectedProfileId = $state(DEFAULT_PROFILE_ID);
  let status = $state("Siap");
  let busy = $state(false);

  function getRuleCount(profId: string): number {
    return rules.filter((r) => r.profileId === profId).length;
  }

  onMount(async () => {
    const data = await loadData();
    profiles = data.profiles;
    rules = data.rules;

    const savedActiveId = await getActiveProfileId();
    if (profiles.some((p) => p.id === savedActiveId)) {
      selectedProfileId = savedActiveId;
    } else if (profiles.length > 0) {
      selectedProfileId = profiles[0].id;
    }
  });

  async function onProfileChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    selectedProfileId = val;
    await setActiveProfileId(val);
  }

  async function createNewProfile() {
    const name = prompt("Masukkan nama profil baru:");
    if (!name || !name.trim()) return;

    const newProf: Profile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      enabled: true,
      createdAt: Date.now()
    };
    const data = await loadData();
    data.profiles.push(newProf);
    await saveData(data);

    profiles = data.profiles;
    selectedProfileId = newProf.id;
    await setActiveProfileId(newProf.id);
    status = `Profil "${newProf.name}" berhasil dibuat.`;
  }

  function isRestrictedUrl(url?: string): boolean {
    if (!url) return false;
    return (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("view-source:") ||
      url.startsWith("devtools://") ||
      url.includes("chromewebstore.google.com") ||
      url.includes("chrome.google.com/webstore")
    );
  }

  async function getActiveTab() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    }
    if (!tab?.id) throw new Error("Tidak menemukan tab aktif");
    if (isRestrictedUrl(tab.url)) {
      throw new Error("Tidak dapat berjalan pada halaman internal browser.");
    }
    return tab;
  }

  async function sendMessageWithFallback(tabId: number, message: any) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, message);
      if (res !== undefined) return res;
      throw new Error("No response");
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
      await new Promise((r) => setTimeout(r, 120));
      return await chrome.tabs.sendMessage(tabId, message);
    }
  }

  async function run() {
    busy = true;
    status = "Mengisi formulir...";
    try {
      const tab = await getActiveTab();
      const response = await sendMessageWithFallback(tab.id!, {
        type: "MATARAM_RUN_AUTOFILL",
        profileId: selectedProfileId
      });

      if (response && !response.ok && response.error) {
        throw new Error(response.error);
      }

      const filled = (response?.results ?? []).reduce((sum: number, item: any) => sum + item.filled, 0);
      if (filled > 0) {
        status = `Selesai · ${filled} field formulir berhasil diisi!`;
      } else {
        status = "0 field diisi. Belum ada aturan tersimpan untuk form ini.";
      }
    } catch (err: any) {
      status = err?.message || "Gagal mengisi formulir pada halaman ini.";
    } finally {
      busy = false;
    }
  }

  async function capture() {
    busy = true;
    status = "Membaca field formulir...";
    try {
      const tab = await getActiveTab();
      const response = await sendMessageWithFallback(tab.id!, {
        type: "MATARAM_CAPTURE_FORM",
        profileId: selectedProfileId
      });

      if (!response?.ok || !Array.isArray(response?.rules)) {
        throw new Error(response?.error || "Gagal membaca form.");
      }

      const capturedRules = response.rules;
      if (capturedRules.length === 0) {
        status = "Tidak ada isian form yang terdeteksi. Silakan ketikkan isian di form terlebih dahulu.";
        return;
      }

      const data = await loadData();
      const capturedPatterns = new Set(capturedRules.map((r: any) => r.matcher.pattern));
      // Replace existing rules with same matcher pattern in this profile, or append new
      const retainedRules = data.rules.filter(
        (r) => r.profileId !== selectedProfileId || !capturedPatterns.has(r.matcher.pattern)
      );
      data.rules = [...retainedRules, ...capturedRules];
      await saveData(data);

      rules = data.rules;
      status = `Berhasil menyimpan ${capturedRules.length} field ke profil aktif!`;
    } catch (err: any) {
      status = err?.message || "Gagal menyimpan form dari halaman ini.";
    } finally {
      busy = false;
    }
  }
</script>

<main class="shell">
  <header>
    <div class="mark">⚡</div>
    <div>
      <h1>Mataram Autofill</h1>
      <p>Form Automation & Generator</p>
    </div>
  </header>

  <!-- Profile Box -->
  <div class="profile-box">
    <div class="profile-header">
      <label for="profileSelect">Profil Aktif:</label>
      <button class="text-btn" onclick={createNewProfile}>+ Buat Profil Baru</button>
    </div>
    <select id="profileSelect" value={selectedProfileId} onchange={onProfileChange}>
      {#each profiles as p (p.id)}
        <option value={p.id}>{p.name} ({getRuleCount(p.id)} aturan)</option>
      {/each}
    </select>
  </div>

  <!-- Primary Actions -->
  <div class="actions-stack">
    <button class="primary" onclick={run} disabled={busy}>
      {busy ? "Sedang Mengisi..." : "⚡ Auto Fill Sekarang"}
    </button>
    <button class="secondary" onclick={capture} disabled={busy} title="Membaca semua field yang sedang terisi dan menyimpannya sebagai aturan">
      📋 Simpan Form Ini (Generate Rules)
    </button>
  </div>

  <p class="status">{status}</p>

  <footer>
    <button class="secondary" style="width: auto; padding: 6px 12px;" onclick={() => chrome.runtime.openOptionsPage()}>
      Tabel Aturan (Options) ↗
    </button>
    <span>Local storage</span>
  </footer>
</main>
