// ==UserScript==
// @name         Kleinanzeigen Tools
// @namespace    https://github.com/mdjdev/kleinanzeigen-tools
// @version      1.0.0
// @description  Dupliziert oder stellt Kleinanzeigen-Inserate neu ein
// @match        https://www.kleinanzeigen.de/p-anzeige-bearbeiten.html*
// @icon         https://www.google.com/s2/favicons?domain=www.kleinanzeigen.de
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/mdjdev/kleinanzeigen-tools/main/kleinanzeigen-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/mdjdev/kleinanzeigen-tools/main/kleinanzeigen-tools.user.js
// ==/UserScript==

(() => {
    'use strict';

    const PREFIX = '[KAZ Tools]';
    const PANEL_ID = 'kaz-tools-panel';

    function log(...args) {
        console.log(PREFIX, ...args);
    }

    function getForm() {
        return document.querySelector('form');
    }

    function getAdId() {
        return (
            document.querySelector('input[name="adId"]')?.value ||
            new URLSearchParams(location.search).get('adId')
        );
    }

    function getCsrfToken() {
        return (
            document.querySelector('input[name="_csrf"]')?.value ||
            document.querySelector('meta[name="csrf-token"]')?.content ||
            null
        );
    }

    function collectFormData() {
        const form = getForm();

        if (!form) {
            throw new Error('Kein Formular gefunden. Seite vollständig laden lassen und erneut versuchen.');
        }

        const data = new FormData();

        for (const field of form.querySelectorAll('input, textarea, select')) {
            if (!field.name || field.disabled) continue;
            if (field.name === 'adId') continue;
            if ((field.type === 'radio' || field.type === 'checkbox') && !field.checked) continue;
            if (field.type === 'file') continue;

            data.append(field.name, field.value);
        }

        const csrf = getCsrfToken();
        if (csrf) data.set('_csrf', csrf);

        return data;
    }

    async function submitListing() {
        const formData = collectFormData();

        const response = await fetch(
            'https://www.kleinanzeigen.de/_actions/postListingWeb.submitListing/',
            {
                method: 'POST',
                credentials: 'include',
                body: formData,
                headers: {
                    accept: 'text/html,application/json,*/*',
                },
            }
        );

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`Erstellen fehlgeschlagen: HTTP ${response.status}\n${responseText.slice(0, 400)}`);
        }

        return responseText;
    }

    async function deleteAd(adId) {
        const csrf = getCsrfToken();

        const response = await fetch(
            `https://www.kleinanzeigen.de/m-anzeigen-loeschen.json?ids=${encodeURIComponent(adId)}`,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    accept: 'application/json,text/plain,*/*',
                    ...(csrf ? { 'x-csrf-token': csrf } : {}),
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Löschen fehlgeschlagen: HTTP ${response.status}`);
        }
    }

    function redirectUrl(responseText) {
        const match = responseText.match(
            /https?:\\?\/\\?\/www\.kleinanzeigen\.de\\?\/[^"'\\\s<]+/
        );

        if (match) {
            return match[0]
                .replaceAll('\\/', '/')
                .replaceAll('\\', '');
        }

        return 'https://www.kleinanzeigen.de/m-meine-anzeigen.html';
    }

    function setStatus(message, type = 'normal') {
        const status = document.querySelector(`#${PANEL_ID} .kaz-status`);
        if (!status) return;

        status.textContent = message;
        status.dataset.type = type;
    }

    function setBusy(isBusy) {
        document.querySelectorAll(`#${PANEL_ID} button`).forEach((button) => {
            button.disabled = isBusy;
        });
    }

    function addPanel() {
        if (document.getElementById(PANEL_ID)) {
            log('Panel already exists.');
            return;
        }

        const panel = document.createElement('section');
        panel.id = PANEL_ID;

        panel.innerHTML = `
            <div class="kaz-header">
                <strong>Kleinanzeigen Tools</strong>
                <button class="kaz-close" type="button" title="Schließen">×</button>
            </div>
            <div class="kaz-body">
                <button class="kaz-action kaz-duplicate" type="button">📋 Anzeige duplizieren</button>
                <button class="kaz-action kaz-relist" type="button">🔄 Neu einstellen</button>
                <div class="kaz-status">Bereit. Ad-ID: ${getAdId() || 'nicht gefunden'}</div>
            </div>
        `;

        const style = document.createElement('style');
        style.id = `${PANEL_ID}-style`;
        style.textContent = `
            #${PANEL_ID} {
                position: fixed !important;
                right: 20px !important;
                bottom: 20px !important;
                z-index: 2147483647 !important;
                width: 290px !important;
                overflow: hidden !important;
                border: 1px solid #bbb !important;
                border-radius: 12px !important;
                background: #fff !important;
                color: #1d1d1d !important;
                box-shadow: 0 8px 30px rgba(0, 0, 0, .3) !important;
                font-family: Arial, sans-serif !important;
                font-size: 14px !important;
                line-height: 1.35 !important;
            }

            #${PANEL_ID} * {
                box-sizing: border-box !important;
            }

            #${PANEL_ID} .kaz-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 12px 14px !important;
                background: #ff6f00 !important;
                color: #fff !important;
            }

            #${PANEL_ID} .kaz-close {
                width: 28px !important;
                height: 28px !important;
                border: 0 !important;
                border-radius: 5px !important;
                background: transparent !important;
                color: #fff !important;
                font-size: 22px !important;
                line-height: 1 !important;
                cursor: pointer !important;
            }

            #${PANEL_ID} .kaz-body {
                display: grid !important;
                gap: 10px !important;
                padding: 14px !important;
                background: #fff !important;
            }

            #${PANEL_ID} .kaz-action {
                min-height: 42px !important;
                width: 100% !important;
                border: 1px solid #555 !important;
                border-radius: 7px !important;
                background: #fff !important;
                color: #111 !important;
                font-size: 14px !important;
                font-weight: 700 !important;
                cursor: pointer !important;
            }

            #${PANEL_ID} .kaz-action:hover {
                background: #f3f3f3 !important;
            }

            #${PANEL_ID} .kaz-action:disabled {
                opacity: .55 !important;
                cursor: wait !important;
            }

            #${PANEL_ID} .kaz-status {
                padding-top: 2px !important;
                color: #555 !important;
                font-size: 12px !important;
                overflow-wrap: anywhere !important;
            }

            #${PANEL_ID} .kaz-status[data-type="error"] {
                color: #b00020 !important;
                font-weight: 700 !important;
            }
        `;

        document.getElementById(`${PANEL_ID}-style`)?.remove();
        document.head.appendChild(style);
        document.body.appendChild(panel);

        panel.querySelector('.kaz-close').addEventListener('click', () => {
            panel.remove();
        });

        panel.querySelector('.kaz-duplicate').addEventListener('click', async () => {
            setBusy(true);
            setStatus('Anzeige wird dupliziert …');

            try {
                const responseText = await submitListing();
                setStatus('Erfolgreich. Weiterleitung …');
                log('Duplicate response:', responseText.slice(0, 500));

                setTimeout(() => {
                    location.href = redirectUrl(responseText);
                }, 800);
            } catch (error) {
                console.error(PREFIX, error);
                setStatus(error.message, 'error');
                setBusy(false);
            }
        });

        panel.querySelector('.kaz-relist').addEventListener('click', async () => {
            const adId = getAdId();

            if (!adId) {
                setStatus('Ad-ID nicht gefunden.', 'error');
                return;
            }

            if (!confirm(`Anzeige #${adId} löschen und neu einstellen?`)) {
                return;
            }

            setBusy(true);
            setStatus('Alte Anzeige wird gelöscht …');

            try {
                await deleteAd(adId);

                setStatus('Neue Anzeige wird erstellt …');
                await new Promise((resolve) => setTimeout(resolve, 1000));

                const responseText = await submitListing();
                setStatus('Erfolgreich. Weiterleitung …');

                setTimeout(() => {
                    location.href = redirectUrl(responseText);
                }, 800);
            } catch (error) {
                console.error(PREFIX, error);
                setStatus(error.message, 'error');
                setBusy(false);
            }
        });

        log('Floating panel added successfully.');
    }

    function start() {
        log('Userscript loaded:', location.href);

        if (document.body) {
            addPanel();
            return;
        }

        document.addEventListener('DOMContentLoaded', addPanel, { once: true });
    }

    start();
})();