/* =========================================================
 * ES BUTTON HELPER - Modul reusable untuk tombol Perbaharui Index Elastic
 * - Dependensi: jQuery, Bootstrap modal (sudah ada di main.html)
 * - Dipakai oleh halaman Penyedia (index.html) dan Swakelola (index_s.html)
 * - Variable global yang HARUS di-inject di view sebelum file ini:
 *   window.TAHUN_ANGGARAN_ES, window.TIPE_ES, window.IS_ES_FAILED_INITIAL,
 *   window.LATEST_LOOKUP_VALUE_INITIAL
 * ========================================================= */
(function( window, $ ) {
    'use strict';

    /* ---------------------------
     *  KONFIGURASI & STATE
     * --------------------------- */
    var POLL_INTERVAL_MS   = 15 * 1000;       /* polling tiap 15 detik  */
    var SAFETY_TIMEOUT_MS  = 2  * 60 * 60 * 1000; /* auto enable 2 jam */
    var BTN_ORIGINAL_TEXT  = 'Perbaharui Index Elastic';
    var RESUME_BTN_TEXT    = 'Lanjutkan Index Elastic';

    var $btn;
    var $resumeBtn;        /* tombol "Lanjutkan Index Elastic" (opsional, hanya SUPERADMIN) */
    var pollingTimer   = null;
    var safetyTimer    = null;
    var currentSinceTs = 0;

    /* ---------------------------
     *  UTIL: Storage Key
     * --------------------------- */
    function getStorageKey() {
        return 'es_processing_' + window.TAHUN_ANGGARAN_ES + '_' + window.TIPE_ES;
    }

    /* ---------------------------
     *  STATE: Set Tombol
     *  state: 'normal' | 'checking' | 'processing'
     * --------------------------- */
    function setESButtonState(state) {
        if (!$btn || $btn.length === 0) return;
        /* Tombol "Lanjutkan" ikut terkunci selama proses apa pun berjalan, label tetap. */
        if ($resumeBtn && $resumeBtn.length > 0) {
            var locked = (state === 'checking' || state === 'processing');
            $resumeBtn.prop('disabled', locked)
                .css('opacity', locked ? '0.7' : '')
                .css('cursor', locked ? 'not-allowed' : '')
                .text(RESUME_BTN_TEXT);
        }
        switch(state) {
            case 'checking':
                $btn.prop('disabled', true)
                    .css('opacity', '0.7')
                    .css('cursor', 'not-allowed')
                    .text('Mengecek status...');
                break;
            case 'processing':
                $btn.prop('disabled', true)
                    .css('opacity', '0.7')
                    .css('cursor', 'not-allowed')
                    .text('⏳ Sedang memproses Tahun ' + window.TAHUN_ANGGARAN_ES + '...');
                break;
            case 'normal':
            default:
                $btn.prop('disabled', false)
                    .css('opacity', '')
                    .css('cursor', '')
                    .text(BTN_ORIGINAL_TEXT);
                break;
        }
    }

    /* ---------------------------
     *  MODAL: Index Sudah Current (Konfirmasi run ulang)
     * --------------------------- */
    function showESCurrentModal(lookupValue, onConfirmRun) {
        var modalId = 'esCurrentModal';
        _ensureModalExist(modalId, {
            title: 'ℹ️ Index Sudah Terbaru',
            bodyHtml:
                '<p>Index Elasticsearch <strong>' + window.TIPE_ES + '</strong> Tahun Anggaran <strong>' + window.TAHUN_ANGGARAN_ES + '</strong> sudah terbaru.</p>' +
                '<p>Terakhir diperbaharui pada: <strong>' + (lookupValue || '-') + '</strong></p>' +
                '<p class="text-warning"><em>Anda tetap bisa menjalankan ulang indexing jika dibutuhkan (misal data anomaly).</em></p>',
            primaryBtnText: 'Ya, Tetap Jalankan Ulang',
            primaryBtnClass: 'btn-warning',
            cancelBtnText: 'Tidak, Batal',
            onPrimary: function() {
                $('#' + modalId).modal('hide');
                if (typeof onConfirmRun === 'function') onConfirmRun();
            }
        });
        $('#' + modalId).modal('show');
    }

    /* ---------------------------
     *  MODAL: Index Gagal
     * --------------------------- */
    function showESErrorModal(message) {
        var modalId = 'esErrorModal';
        _ensureModalExist(modalId, {
            title: '❌ Index Gagal Diproses',
            bodyHtml:
                '<p>Proses indexing <strong>' + window.TIPE_ES + '</strong> Tahun <strong>' + window.TAHUN_ANGGARAN_ES + '</strong> mengalami kegagalan.</p>' +
                (message ? '<p class="text-danger"><strong>Detail:</strong> ' + message + '</p>' : '') +
                '<p>Anda bisa mengklik tombol lagi untuk mencoba ulang.</p>',
            primaryBtnText: 'Tutup',
            primaryBtnClass: 'btn-danger',
            hideCancel: true
        });
        $('#' + modalId).modal('show');
    }

    /* ---------------------------
     *  MODAL: Index Berhasil
     *  Logika baru (DATE ONLY):
     *  Sukses = TANGGAL lookup_value == TANGGAL TODAY (hari ini).
     *  Tidak peduli apakah job benar-benar index atau skip "already indexed today".
     * --------------------------- */
    function showESSuccessModal(lookupValue) {
        var modalId = 'esSuccessModal';
        var bodyHtml =
            '<p>Proses indexing <strong>' + window.TIPE_ES + '</strong> Tahun <strong>' + window.TAHUN_ANGGARAN_ES + '</strong> telah selesai.</p>' +
            '<p>Data lookup pada tanggal <strong>HARI INI</strong> (sudah di-index hari ini):</p>' +
            '<p class="text-success" style="font-size:16px;"><strong>' + (lookupValue || '-') + '</strong></p>' +
            '<p class="text-muted" style="font-size:12px;margin-top:10px;">' +
            'ℹ️ Perbandingan hanya menggunakan <code>DATE(lookup_value)</code>. ' +
            'Jika hari ini sudah pernah index, dianggap sudah selesai.' +
            '</p>' +
            '<div class="alert alert-info" style="margin-top:15px;font-size:12px;">' +
            '  <i class="icon-refresh"></i> <strong>Info:</strong> Halaman akan <strong>OTOMATIS REFRESH</strong> ketika Anda menutup dialog ini' +
            '  untuk memuat data paket terbaru hasil indexing.' +
            '</div>';
        _ensureModalExist(modalId, {
            title: '✅ Index Sudah Diperbaharui Hari Ini',
            bodyHtml: bodyHtml,
            primaryBtnText: 'Tutup',
            primaryBtnClass: 'btn-success',
            hideCancel: true
        });
        /* =========================================================
         * AUTO RELOAD KETIKA MODAL SUKSES DITUTUP (APA PUN CARANYA):
         * - Klik tombol [Tutup]
         * - Klik icon (X) pojok kanan atas
         * - Klik area backdrop di luar modal
         * Event "hidden.bs.modal" = Bootstrap fire setelah animasi hide selesai.
         * Gunakan .off() + .one() = handler HANYA jalan 1x, tidak double bind.
         * ========================================================= */
        $('#' + modalId)
            .off('hidden.bs.modal.es_reload') /* bersihkan handler lama jika ada */
            .one('hidden.bs.modal.es_reload', function() {
                try {
                    localStorage.removeItem(getStorageKey()); /* double clean up storage lock */
                } catch(e){}
                /* Reload halaman untuk memuat data index terbaru */
                window.location.reload(true); /* true = bypass cache (force reload from server) */
            });
        $('#' + modalId).modal('show');
    }

    /* ---------------------------
     *  MODAL: Gagal Init / Error Fetch
     * --------------------------- */
    function showESInfoModal(title, bodyHtml) {
        var modalId = 'esInfoModal';
        _ensureModalExist(modalId, {
            title: title || 'Informasi',
            bodyHtml: bodyHtml || '',
            primaryBtnText: 'Tutup',
            primaryBtnClass: 'btn-info',
            hideCancel: true
        });
        $('#' + modalId).modal('show');
    }

    /* ---------------------------
     *  INTERNAL: Pastikan DOM Modal ada, buat jika belum
     * --------------------------- */
    function _ensureModalExist(modalId, opts) {
        if ($('#' + modalId).length > 0) {
            /* update konten saja */
            $('#' + modalId + ' .modal-title').html(opts.title);
            $('#' + modalId + ' .modal-body').html(opts.bodyHtml);
            var $pri = $('#' + modalId + ' .btn-primary-modal');
            $pri.off('click').removeClass('btn-primary btn-warning btn-danger btn-success btn-info')
                .addClass(opts.primaryBtnClass || 'btn-primary')
                .text(opts.primaryBtnText || 'OK');
            if (typeof opts.onPrimary === 'function') {
                $pri.on('click', opts.onPrimary);
            }
            $('#' + modalId + ' .btn-cancel-modal').toggle(!opts.hideCancel);
            return;
        }

        var cancelBtn = opts.hideCancel ? '' :
            '<button type="button" class="btn btn-default btn-cancel-modal" data-dismiss="modal">' +
            (opts.cancelBtnText || 'Batal') + '</button>';

        var html =
        '<div id="' + modalId + '" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="' + modalId + 'Label" aria-hidden="true">' +
        '  <div class="modal-dialog modal-md">' +
        '    <div class="modal-content">' +
        '      <div class="modal-header">' +
        '        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>' +
        '        <h4 class="modal-title" id="' + modalId + 'Label">' + opts.title + '</h4>' +
        '      </div>' +
        '      <div class="modal-body">' + opts.bodyHtml + '</div>' +
        '      <div class="modal-footer">' +
                cancelBtn +
        '        <button type="button" class="btn btn-primary-modal ' + (opts.primaryBtnClass || 'btn-primary') + '">' +
                (opts.primaryBtnText || 'OK') + '</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
        $('body').append(html);
        var $pri = $('#' + modalId + ' .btn-primary-modal');
        if (opts.hideCancel) {
            $pri.on('click', function() { $('#' + modalId).modal('hide'); });
        }
        if (typeof opts.onPrimary === 'function') {
            $pri.on('click', opts.onPrimary);
        }
    }

    /* ---------------------------
     *  AJAX: Pre-check sebelum run
     *  onOkRun(boolean paksaRun) - callback jika lanjut jalankan job
     * --------------------------- */
    function preCheckES(onOkRun) {
        setESButtonState('checking');
        $.ajax({
            url: '/sirup/caripaketctr/preCheckES',
            type: 'GET',
            data: {
                tahunAnggaran: window.TAHUN_ANGGARAN_ES,
                tipe: window.TIPE_ES
            },
            dataType: 'json',
            /* [PERBAIKAN] FORCE kirim X-Requested-With agar backend isAjaxRequest() 100%
               mendeteksi AJAX. jQuery shorthand TIDAK SELALU mengirim header ini andal. */
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
            },
            success: function(res) {
                /* Guard: jika backend balik 200 OK tapi payload error=true (contoh: business rule gagal),
                   tampilkan toast juga, jangan cuma modal generic. */
                if (res && res.error === true) {
                    setESButtonState('normal');
                    _showESAuthOrErrorToast(res.message || 'Permintaan tidak dapat diproses oleh server.');
                    return;
                }

                if (!res || res.ok !== true) {
                    setESButtonState('normal');
                    showESInfoModal('⚠️ Gagal Mengecek Status',
                        '<p>Tidak dapat memeriksa status index ke server.</p>' +
                        (res && res.error ? '<p class="text-danger">Error: ' + res.error + '</p>' : '') +
                        '<p>Silakan coba beberapa saat lagi.</p>');
                    return;
                }

                if (res.isFailed) {
                    setESButtonState('normal');
                    showESInfoModal('⚠️ Proses Sebelumnya Gagal',
                        '<p>Terdeteksi proses indexing sebelumnya untuk <strong>' + window.TIPE_ES + ' Tahun ' + window.TAHUN_ANGGARAN_ES +
                        '</strong> berakhir <strong class="text-danger">GAGAL</strong>.</p>' +
                        '<p>Silakan tutup dialog ini, lalu <strong>klik tombol Perbaharui Index Elastic kembali</strong> jika ingin mencoba ulang.</p>');
                    return;
                }

                if (res.isCurrent) {
                    setESButtonState('normal');
                    showESCurrentModal(res.lookupValue, function() {
                        if (typeof onOkRun === 'function') onOkRun(true);
                    });
                    return;
                }

                if (typeof onOkRun === 'function') onOkRun(false);
            },
            error: function(xhr, textStatus, errorThrown) {
                setESButtonState('normal');

                var defaultMsg = 'Anda tidak memiliki hak akses (SUPERADMIN) untuk memperbaharui index Elastic. Silakan hubungi Administrator.';
                var fallbackParseMsg = 'Session Anda mungkin telah berakhir atau Anda tidak memiliki hak akses. Silakan muat ulang halaman, login kembali, atau hubungi Administrator.';
                var msg = defaultMsg;

                /* [PERBAIKAN] Handle SEMUA kemungkinan status: 401 session expired,
                   403 forbidden SUPERADMIN, parsererror (redirect HTML difollow browser). */
                try {
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        msg = xhr.responseJSON.message;
                    } else if (xhr.responseText) {
                        try {
                            var parsed = JSON.parse(xhr.responseText);
                            if (parsed.message) msg = parsed.message;
                        } catch (parseInner) {
                            msg = fallbackParseMsg;
                        }
                    }
                } catch (e) {
                    msg = fallbackParseMsg;
                }

                if (xhr.status === 401) {
                    msg = (msg === defaultMsg ? fallbackParseMsg : msg);
                }

                if (textStatus === 'parsererror' || (xhr.status === 0 && textStatus === 'error')) {
                    msg = fallbackParseMsg;
                }

                /* HANYA gunakan toast JIKA indikasi auth error (401/403/parseerror).
                   Selain itu (network murni), gunakan modal info seperti sebelumnya. */
                var isAuthRelated = (xhr.status === 401 || xhr.status === 403 || textStatus === 'parsererror');
                if (isAuthRelated) {
                    /* Jika toast function tidak tersedia atau return false, fallback alert() native. */
                    var toastOk = false;
                    if (window.showESPermissionToast) {
                        try { toastOk = window.showESPermissionToast(msg, 'error'); } catch (tErr) { toastOk = false; }
                    }
                    if (!toastOk) {
                        window.alert(msg);
                    }
                } else {
                    showESInfoModal('⚠️ Gagal Terkoneksi ke Server',
                        '<p>Tidak dapat menghubungi server untuk pengecekan status index.</p>' +
                        '<p>Pastikan koneksi internet Anda stabil, lalu coba lagi.</p>');
                }
            }
        });
    }

    /* ---------------------------
     *  AJAX: Jalankan Job Indexing
     *  Setelah ok, langsung start polling since = now
     * --------------------------- */
    function runESIndexing(mode) {
        var isResume = (mode === 'resume');
        var sinceTs = Date.now();
        currentSinceTs = sinceTs;
        localStorage.setItem(getStorageKey(), String(sinceTs));

        /* Mode lanjutan tidak menghapus index, jadi tabel tidak perlu dikosongkan. */
        if (!isResume) {
            try {
                if (typeof window.ES_CLEAR_TABLE_CALLBACK === 'function') {
                    window.ES_CLEAR_TABLE_CALLBACK();
                }
            } catch(e) { /* abaikan gagal clear table */ }
        }

        setESButtonState('processing');

        var actionUrl;
        if (isResume) {
            actionUrl = ('SWAKELOLA' === window.TIPE_ES)
                ? '/sirup/caripaketctr/resumeESIndexingSwakelola'
                : '/sirup/caripaketctr/resumeESIndexingPenyedia';
        } else {
            actionUrl = ('SWAKELOLA' === window.TIPE_ES)
                ? '/sirup/caripaketctr/updateESIndexingSwakelola'
                : '/sirup/caripaketctr/updateESIndexingPenyedia';
        }

        $.ajax({
            url: actionUrl,
            type: 'GET',
            data: { tahunAnggaran: window.TAHUN_ANGGARAN_ES },
            dataType: 'json',
            /* [PERBAIKAN] FORCE kirim header AJAX + Accept JSON agar backend isAjaxRequest()
               100% mendeteksi AJAX → response JSON 401/403 bukan redirect HTML. */
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json, text/javascript, */*; q=0.01');
            },
            success: function(data) {
                /* Guard defensive: backend mengembalikan 200 OK tapi payload error=true
                   (misal: allowAccess tidak jalan tapi interceptor handle custom).
                   Jangan polling, langsung tampilkan error user-friendly. */
                if (data && data.error === true) {
                    localStorage.removeItem(getStorageKey());
                    setESButtonState('normal');
                    _showESAuthOrErrorToast(data.message || 'Permintaan indexing ditolak oleh server.');
                    return;
                }
                startESPolling(sinceTs);
            },
            error: function(xhr, textStatus, errorThrown) {
                localStorage.removeItem(getStorageKey());
                setESButtonState('normal');

                var defaultMsg = 'Anda tidak memiliki hak akses (SUPERADMIN) untuk memperbaharui index Elastic. Silakan hubungi Administrator.';
                var fallbackParseMsg = 'Session Anda mungkin telah berakhir atau Anda tidak memiliki hak akses. Silakan muat ulang halaman, login kembali, atau hubungi Administrator.';
                var msg = defaultMsg;

                try {
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        msg = xhr.responseJSON.message;
                    } else if (xhr.responseText) {
                        try {
                            var parsed = JSON.parse(xhr.responseText);
                            if (parsed.message) msg = parsed.message;
                        } catch (parseInner) {
                            msg = fallbackParseMsg;
                        }
                    }
                } catch (e) {
                    msg = fallbackParseMsg;
                }

                if (xhr.status === 401) {
                    msg = (msg === defaultMsg ? fallbackParseMsg : msg);
                }

                if (textStatus === 'parsererror' || (xhr.status === 0 && textStatus === 'error')) {
                    msg = fallbackParseMsg;
                }

                var isAuthRelated = (xhr.status === 401 || xhr.status === 403 || textStatus === 'parsererror');
                if (isAuthRelated) {
                    var toastOk = false;
                    if (window.showESPermissionToast) {
                        try { toastOk = window.showESPermissionToast(msg, 'error'); } catch (tErr) { toastOk = false; }
                    }
                    if (!toastOk) {
                        window.alert(msg);
                    }
                } else {
                    showESInfoModal('❌ Gagal Menjalankan Index',
                        '<p>Permintaan indexing gagal dikirim ke server.</p>' +
                        '<p>Pastikan server berjalan normal, lalu coba lagi.</p>');
                }
            }
        });
    }

    /**
     * Helper kecil: tampilkan toast error auth / general,
     * dengan fallback alert() native jika DOM toast tidak tersedia / gagal render.
     * Digunakan di preCheckES success guard, runESIndexing success guard,
     * dan path error keduanya (agar DRY).
     */
    function _showESAuthOrErrorToast(msg) {
        var toastOk = false;
        if (window.showESPermissionToast) {
            try { toastOk = window.showESPermissionToast(msg, 'error'); } catch (tErr) { toastOk = false; }
        }
        if (!toastOk) {
            window.alert(msg);
        }
    }

    /* ---------------------------
     *  POLLING: Cek status tiap 15 detik, safety timeout 2 jam
     *  Logika BARU (DATE ONLY): server-side sudah cek DATE(lookup)==DATE(today).
     *  - Jika lookup sudah tanggal hari ini: POLLING PERTAMA -> SUCCESS! (karena tidak butuh rubah value)
     *  - Jika lookup kemarin / null: tunggu sampai Job ES update lookup jadi tanggal hari ini
     * --------------------------- */
    function startESPolling(sinceTs) {
        stopESPolling(); /* bersihkan timer lama jika ada */
        currentSinceTs = sinceTs;

        function _doPoll() {
            $.ajax({
                url: '/sirup/caripaketctr/checkESStatus',
                type: 'GET',
                data: {
                    tahunAnggaran: window.TAHUN_ANGGARAN_ES,
                    tipe: window.TIPE_ES,
                    since: sinceTs
                },
                dataType: 'json',
                success: function(res) {
                    if (!res || res.ok !== true) return; /* polling error, coba lagi nanti */
                    if (res.status === 'SUCCESS') {
                        stopESPolling();
                        localStorage.removeItem(getStorageKey());
                        setESButtonState('normal');
                        showESSuccessModal(res.lookupValue);
                    } else if (res.status === 'FAILED') {
                        stopESPolling();
                        localStorage.removeItem(getStorageKey());
                        setESButtonState('normal');
                        showESErrorModal();
                    }
                    /* else PROCESSING -> do nothing, nanti polling lagi */
                }
                /* error: abaikan saja, nanti 15 detik kemudian coba lagi */
            });
        }

        pollingTimer = setInterval(_doPoll, POLL_INTERVAL_MS);
        _doPoll(); /* langsung eksekusi pertama kali, tidak nunggu 15 detik */

        /* SAFETY TIMEOUT FINAL: Setelah 2 jam, auto-enable tombol dan stop polling
         * untuk menghindari tombol terkunci selamanya jika job beneran stuck atau
         * lookup tidak pernah di-update (kasus anomali).
         */
        safetyTimer = setTimeout(function() {
            stopESPolling();
            localStorage.removeItem(getStorageKey());
            setESButtonState('normal');
            showESInfoModal('⏱️ Timeout Proses Index',
                '<p>Proses indexing <strong>' + window.TIPE_ES + '</strong> Tahun <strong>' + window.TAHUN_ANGGARAN_ES +
                '</strong> belum juga selesai dalam batas waktu 2 jam.</p>' +
                '<p>Tombol telah diaktifkan kembali. Anda bisa mencoba lagi, atau cek log server untuk mengetahui kendala.</p>');
        }, SAFETY_TIMEOUT_MS);
    }

    function stopESPolling() {
        if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
        if (safetyTimer)  { clearTimeout(safetyTimer);  safetyTimer  = null; }
    }

    /* ---------------------------
     *  RECOVERY: Page load / refresh,
     *  cek apakah di localStorage masih ada lock -> lanjut polling.
     *  Juga tampilkan modal jika initial state = FAILED.
     * --------------------------- */
    function recoverESStateFromLocalStorage() {
        $btn = $('#esIndexBtn');
        $resumeBtn = $('#esResumeBtn');
        if ($btn.length === 0) return; /* tombol tidak ada di halaman ini */

        /* Jika sebelumnya FAILED dari template initial */
        if (window.IS_ES_FAILED_INITIAL === true || window.IS_ES_FAILED_INITIAL === 'true') {
            showESInfoModal('⚠️ Proses Index Sebelumnya Gagal',
                '<p>Proses indexing <strong>' + window.TIPE_ES + '</strong> Tahun <strong>' + window.TAHUN_ANGGARAN_ES +
                '</strong> sebelumnya berakhir <strong class="text-danger">GAGAL</strong>.</p>' +
                '<p>Anda bisa klik tombol <em>Perbaharui Index Elastic</em> untuk mencoba ulang.</p>');
        }

        var rawSince = localStorage.getItem(getStorageKey());
        if (!rawSince) return;

        var sinceTs = parseInt(rawSince, 10);
        if (isNaN(sinceTs) || sinceTs <= 0) {
            localStorage.removeItem(getStorageKey());
            return;
        }

        var elapsed = Date.now() - sinceTs;
        if (elapsed >= SAFETY_TIMEOUT_MS) {
            localStorage.removeItem(getStorageKey());
            return;
        }

        /* MASIH ADA PROSES YANG BERJALAN -> lanjut polling */
        currentSinceTs = sinceTs;
        setESButtonState('processing');
        startESPolling(sinceTs);
    }

    /* ---------------------------
     *  MASTER HANDLER: Ketika user klik tombol
     * --------------------------- */
    function clickESIndexButtonHandler() {
        if (!$btn || $btn.length === 0) $btn = $('#esIndexBtn');
        if ($btn.length === 0) return;
        if ($btn.prop('disabled')) return; /* double click guard */

        preCheckES(function(paksaRun) {
            runESIndexing();
        });
    }

    /* ---------------------------
     *  HANDLER: Tombol "Lanjutkan Index Elastic"
     *  Lanjut dari paket terakhir yang sudah ada di index, TANPA menghapus index.
     * --------------------------- */
    function clickESResumeButtonHandler() {
        if (!$btn || $btn.length === 0) $btn = $('#esIndexBtn');
        if (!$resumeBtn || $resumeBtn.length === 0) $resumeBtn = $('#esResumeBtn');
        if ($resumeBtn.length === 0) return;
        if ($resumeBtn.prop('disabled')) return; /* double click guard / proses lain berjalan */

        var modalId = 'esResumeModal';
        _ensureModalExist(modalId, {
            title: '▶️ Lanjutkan Index Elastic',
            bodyHtml:
                '<p>Lanjutkan indexing <strong>' + window.TIPE_ES + '</strong> Tahun <strong>' + window.TAHUN_ANGGARAN_ES +
                '</strong> dari paket terakhir yang sudah ada di index.</p>' +
                '<p>Index <strong>tidak dihapus</strong>: data yang sudah ada tetap bisa dicari selama proses berjalan.</p>' +
                '<p class="text-warning"><em>Gunakan setelah proses Perbaharui Index Elastic terhenti di tengah ' +
                '(misalnya karena deploy atau pod restart). Jangan dijalankan saat proses indexing lain masih berjalan.</em></p>',
            primaryBtnText: 'Ya, Lanjutkan',
            primaryBtnClass: 'btn-primary',
            cancelBtnText: 'Batal',
            onPrimary: function() {
                $('#' + modalId).modal('hide');
                runESIndexing('resume');
            }
        });
        $('#' + modalId).modal('show');
    }

    /* ---------------------------
     *  EXPORT: Attach ke window
     * --------------------------- */
    window.ESButtonHelper = {
        init: recoverESStateFromLocalStorage,
        onButtonClick: clickESIndexButtonHandler,
        onResumeClick: clickESResumeButtonHandler,
        setState: setESButtonState,
        _poll: startESPolling,
        _stopPoll: stopESPolling,
        _preCheck: preCheckES,
        _runIndex: runESIndexing
    };

})( window, jQuery );
