<script lang="ts">
  import { onMount } from "svelte";
  import { loadData, saveData } from "../storage/chrome-storage";
  import { DEFAULT_PROFILE_ID } from "../shared/constants";
  import type { AppData, AutofillRule, Profile } from "../shared/types";

  let data = $state<AppData>({ version: 1, profiles: [], rules: [] });
  let message = $state("");
  let newProfileName = $state("");
  let selectedProfileId = $state(DEFAULT_PROFILE_ID);
  let filterProfileId = $state("all");

  let type = $state<"text" | "checkbox" | "radio" | "select">("text");
  let attribute = $state<"name" | "id" | "label" | "placeholder" | "aria-label">("name");
  let pattern = $state("");
  let value = $state("");
  let site = $state("");
  let mode = $state<"safe" | "overwrite">("safe");

  onMount(async () => {
    data = await loadData();
    if (data.profiles.length > 0) {
      selectedProfileId = data.profiles[0].id;
    }
  });

  async function addProfile() {
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      message = "Nama profil tidak boleh kosong.";
      return;
    }
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      name: trimmed,
      enabled: true,
      createdAt: Date.now()
    };
    data = { ...data, profiles: [...data.profiles, newProfile] };
    await saveData(data);
    selectedProfileId = newProfile.id;
    newProfileName = "";
    message = `Profil "${trimmed}" berhasil dibuat!`;
  }

  async function toggleProfile(id: string) {
    data = {
      ...data,
      profiles: data.profiles.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    };
    await saveData(data);
  }

  async function removeProfile(id: string) {
    if (data.profiles.length <= 1) {
      message = "Minimal harus ada satu profil.";
      return;
    }
    const profileToRemove = data.profiles.find((p) => p.id === id);
    if (!confirm(`Hapus profil "${profileToRemove?.name}" beserta seluruh aturannya?`)) return;

    data = {
      ...data,
      profiles: data.profiles.filter((p) => p.id !== id),
      rules: data.rules.filter((r) => r.profileId !== id)
    };
    if (selectedProfileId === id) {
      selectedProfileId = data.profiles[0]?.id ?? DEFAULT_PROFILE_ID;
    }
    await saveData(data);
    message = "Profil berhasil dihapus.";
  }

  async function addRule() {
    if (!pattern.trim()) {
      message = "Field matcher (kata kunci) wajib diisi.";
      return;
    }
    const rule: AutofillRule = {
      id: crypto.randomUUID(),
      profileId: selectedProfileId || data.profiles[0]?.id || DEFAULT_PROFILE_ID,
      type,
      matcher: { attribute, pattern, matchMode: "partial" },
      value,
      site: site || undefined,
      mode,
      enabled: true,
      order: data.rules.length
    };
    data = { ...data, rules: [...data.rules, rule] };
    await saveData(data);
    pattern = "";
    value = "";
    message = "Aturan berhasil disimpan.";
  }

  async function toggleRule(id: string) {
    data = { ...data, rules: data.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) };
    await saveData(data);
  }

  async function removeRule(id: string) {
    data = { ...data, rules: data.rules.filter((r) => r.id !== id) };
    await saveData(data);
  }

  async function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mataram-autofill-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.version !== 1 || !Array.isArray(parsed.profiles) || !Array.isArray(parsed.rules)) throw new Error();
      data = parsed;
      await saveData(data);
      message = "Data aturan berhasil diimpor.";
    } catch {
      message = "Berkas cadangan tidak valid.";
    }
  }

  function getProfileName(profileId: string): string {
    const p = data.profiles.find((item) => item.id === profileId);
    return p ? p.name : "Default";
  }

  const visibleRules = $derived(
    filterProfileId === "all" ? data.rules : data.rules.filter((r) => r.profileId === filterProfileId)
  );
</script>

<div class="options">
  <header>
    <div class="mark">⚡</div>
    <div>
      <h1>Mataram Autofill</h1>
      <p>Kelola Profil & Tabel Aturan Formulir</p>
    </div>
  </header>

  <!-- Section 1: Profil Management -->
  <section class="panel">
    <h2>Profil Autofill ({data.profiles.length})</h2>
    <div class="profile-input-row">
      <input
        bind:value={newProfileName}
        placeholder="Nama profil baru (misal: RUP Paket ATK / Konstruksi)"
        onkeydown={(e) => e.key === "Enter" && addProfile()}
      />
      <button class="primary" style="width: auto; white-space: nowrap;" onclick={addProfile}>
        + Tambah Profil
      </button>
    </div>

    {#each data.profiles as profile (profile.id)}
      <div class="rule">
        <div>
          <strong>{profile.name}</strong>
          <small>{data.rules.filter((r) => r.profileId === profile.id).length} aturan tersimpan · {profile.enabled ? "Aktif" : "Nonaktif"}</small>
        </div>
        <div class="actions">
          <button class="secondary" style="width: auto;" onclick={() => toggleProfile(profile.id)}>
            {profile.enabled ? "Nonaktifkan" : "Aktifkan"}
          </button>
          {#if data.profiles.length > 1}
            <button class="danger" onclick={() => removeProfile(profile.id)}>Hapus</button>
          {/if}
        </div>
      </div>
    {/each}
  </section>

  <!-- Section 2: Create Rule Manually -->
  <section class="panel">
    <h2>Buat Aturan Baru Secara Manual</h2>
    <div class="form-grid">
      <label>
        Simpan ke Profil
        <select bind:value={selectedProfileId}>
          {#each data.profiles as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </label>
      <label>
        Tipe Field
        <select bind:value={type}>
          <option value="text">Text / Textarea</option>
          <option value="checkbox">Checkbox</option>
          <option value="radio">Radio</option>
          <option value="select">Dropdown (Select)</option>
        </select>
      </label>
      <label>
        Pencocokan Atribut
        <select bind:value={attribute}>
          <option value="name">name</option>
          <option value="id">id</option>
          <option value="label">label (teks label formulir)</option>
          <option value="placeholder">placeholder</option>
          <option value="aria-label">aria-label</option>
        </select>
      </label>
      <label>
        Kata Kunci Matcher
        <input bind:value={pattern} placeholder="Contoh: paket.nama" />
      </label>
      <label>
        Nilai Isian (Value)
        <input bind:value={value} placeholder="Nilai yang ingin diisikan" />
      </label>
      <label>
        Filter Situs (Opsional)
        <input bind:value={site} placeholder="Kosongkan untuk semua situs atau e.g. sirup" />
      </label>
      <label>
        Mode Pengisian
        <select bind:value={mode}>
          <option value="overwrite">Overwrite (Selalu timpa)</option>
          <option value="safe">Safe (Jangan timpa yang sudah terisi)</option>
        </select>
      </label>
    </div>
    <button class="primary" onclick={addRule}>+ Simpan Aturan</button>
    {#if message}<p class="status">{message}</p>{/if}
  </section>

  <!-- Section 3: List of Rules -->
  <section class="panel">
    <div class="section-head">
      <div>
        <h2>Daftar Aturan ({visibleRules.length})</h2>
      </div>
      <div class="actions">
        <select bind:value={filterProfileId} style="padding: 7px 10px; font-size: 11px;">
          <option value="all">Semua Profil</option>
          {#each data.profiles as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
        <button class="secondary" style="width: auto;" onclick={exportData}>Export Backup</button>
      </div>
    </div>
    {#if visibleRules.length === 0}
      <p class="empty">Belum ada aturan untuk profil ini. Anda bisa membuat aturan di atas atau klik "Simpan Form Ini" di popup.</p>
    {:else}
      {#each visibleRules as rule (rule.id)}
        <div class="rule">
          <div>
            <strong>
              {rule.matcher.attribute}: {rule.matcher.pattern}
              <span class="badge">{getProfileName(rule.profileId)}</span>
            </strong>
            <small>{rule.type} · {rule.site || "Semua situs"} · {rule.mode}</small>
            <small>Nilai: <strong>{rule.value}</strong></small>
          </div>
          <div class="actions">
            <button class="secondary" style="width: auto;" onclick={() => toggleRule(rule.id)}>
              {rule.enabled ? "Nonaktifkan" : "Aktifkan"}
            </button>
            <button class="danger" onclick={() => removeRule(rule.id)}>Hapus</button>
          </div>
        </div>
      {/each}
    {/if}
  </section>

  <!-- Section 4: Backup & Restore -->
  <section class="panel">
    <h2>Backup & Restore</h2>
    <label class="file">
      Impor Cadangan JSON
      <input type="file" accept="application/json,.json" onchange={importData} />
    </label>
  </section>
</div>
