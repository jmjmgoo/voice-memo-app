/**
 * EchoMemo - Application Logic (Server Version)
 */

class EchoMemo {
    constructor() {
        this.memos = [];
        this.currentMemoId = null;
        this.recognition = null;
        this.isRecording = false;

        // DOM Elements
        this.memoList = document.getElementById('memo-list');
        this.addMemoBtn = document.getElementById('add-memo-btn');
        this.voiceWidgetBtn = document.getElementById('voice-widget-btn');
        this.editModal = document.getElementById('edit-modal');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.deleteMemoBtn = document.getElementById('delete-memo-btn');
        this.saveMemoBtn = document.getElementById('save-memo-btn');
        this.micBtn = document.getElementById('mic-btn');
        this.micIcon = document.getElementById('mic-icon');
        this.newlineBtn = document.getElementById('newline-btn');
        this.memoTextarea = document.getElementById('memo-textarea');
        this.tagInput = document.getElementById('tag-input');
        this.recordingStatus = document.getElementById('recording-status');

        this.newlineTimer = null;
        this.isSameLine = false;

        this.init();
    }

    async init() {
        await this.fetchMemos();
        this.setupEventListeners();
        this.setupSpeechRecognition();
        this.handleUrlActions();
    }

    async fetchMemos() {
        try {
            const response = await fetch('/api/memos');
            if (!response.ok) throw new Error('Fetch failed');
            this.memos = await response.json();
            this.renderMemoList();
        } catch (err) {
            console.error('Error fetching memos:', err);
            // Fallback to empty if server not ready
            this.memos = [];
            this.renderMemoList();
        }
    }

    updateRecordingStatus(message) {
        if (this.recordingStatus) {
            this.recordingStatus.textContent = message;
        }
    }

    handleUrlActions() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'voice') {
            setTimeout(() => {
                this.startVoiceWidget();
            }, 500);
        }
    }

    setupEventListeners() {
        this.addMemoBtn.addEventListener('click', () => this.openModal());
        this.voiceWidgetBtn.addEventListener('click', () => this.startVoiceWidget());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.saveMemoBtn.addEventListener('click', () => this.saveMemo());
        this.deleteMemoBtn.addEventListener('click', () => this.deleteMemo());
        this.micBtn.addEventListener('click', () => this.toggleRecording());
        this.newlineBtn.addEventListener('click', () => this.forceNewline());

        this.editModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal());
    }

    forceNewline() {
        let currentText = this.memoTextarea.value;
        const linePrefix = '　';
        if (currentText.length > 0) {
            if (!currentText.endsWith('\n')) {
                currentText += '\n';
            }
            currentText += linePrefix;
            this.memoTextarea.value = currentText;
        } else {
            this.memoTextarea.value = linePrefix;
        }
        this.resetNewlineTimer();
        this.isSameLine = true;
    }

    resetNewlineTimer() {
        if (this.newlineTimer) clearTimeout(this.newlineTimer);
        this.newlineTimer = setTimeout(() => {
            this.isSameLine = false;
        }, 10000);
    }

    startVoiceWidget() {
        this.openModal();
        this.startRecording();
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported.');
            this.updateRecordingStatus('音声認識非対応のブラウザです');
            this.micBtn.disabled = true;
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ja-JP';
        this.recognition.continuous = true;
        this.recognition.interimResults = false;

        this.recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            if (transcript) {
                this.appendFormattedText(transcript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.stopRecording();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                this.recognition.start();
            }
        };
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        if (!this.recognition) return;
        try {
            this.recognition.start();
            this.isRecording = true;
            this.micBtn.classList.add('recording');
            this.updateRecordingStatus('聞き取り中...');
        } catch (e) {
            console.error('Failed to start recognition:', e);
        }
    }

    stopRecording() {
        if (!this.recognition) return;
        this.recognition.stop();
        this.isRecording = false;
        this.micBtn.classList.remove('recording');
        this.updateRecordingStatus('タップして話す');
    }

    appendFormattedText(text) {
        let currentText = this.memoTextarea.value;
        const linePrefix = '　';

        if (currentText.length === 0) {
            currentText = linePrefix;
        } else if (!this.isSameLine) {
            if (!currentText.endsWith('\n')) {
                currentText += '\n';
            }
            currentText += linePrefix;
        } else {
            if (currentText.length > 0 && !currentText.endsWith('\n') && !currentText.endsWith('　') && !currentText.endsWith(' ')) {
                currentText += ' ';
            }
        }

        const cleanedText = text.replace(/^[・　 ]+/, '');
        this.memoTextarea.value = currentText + cleanedText;
        this.isSameLine = true;
        this.resetNewlineTimer();
        this.memoTextarea.scrollTop = this.memoTextarea.scrollHeight;
    }

    openModal(memoId = null) {
        this.currentMemoId = memoId;
        this.isSameLine = false;

        if (memoId) {
            const memo = this.memos.find(m => m.id == memoId);
            this.memoTextarea.value = memo.content;
            this.tagInput.value = (memo.tags || []).join(', ');
            this.deleteMemoBtn.classList.remove('hidden');
        } else {
            this.memoTextarea.value = '';
            this.tagInput.value = '';
            this.deleteMemoBtn.classList.add('hidden');
        }

        this.editModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.stopRecording();
        if (this.newlineTimer) clearTimeout(this.newlineTimer);
        this.editModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    async saveMemo() {
        const content = this.memoTextarea.value.trim();
        if (!content) {
            this.closeModal();
            return;
        }

        const lines = content.split('\n');
        const firstLine = lines[0].trim().replace(/^　/, '');
        const title = firstLine || '無題のメモ';

        // Tags parsing
        const tags = this.tagInput.value
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        const memoData = { title, content, tags };

        try {
            let response;
            if (this.currentMemoId) {
                // Update
                response = await fetch(`/api/memos/${this.currentMemoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memoData)
                });
            } else {
                // Create
                response = await fetch('/api/memos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memoData)
                });
            }

            if (response.ok) {
                await this.fetchMemos();
                this.closeModal();
            } else {
                alert('保存に失敗しました。');
            }
        } catch (err) {
            console.error('Error saving memo:', err);
            alert('サーバーとの通信に失敗しました。');
        }
    }

    async deleteMemo() {
        if (!this.currentMemoId) return;
        if (!confirm('このメモを削除してもよろしいですか？')) return;

        try {
            const response = await fetch(`/api/memos/${this.currentMemoId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.fetchMemos();
                this.closeModal();
            } else {
                alert('削除に失敗しました。');
            }
        } catch (err) {
            console.error('Error deleting memo:', err);
            alert('サーバーとの通信に失敗しました。');
        }
    }

    renderMemoList() {
        this.memoList.innerHTML = '';

        if (this.memos.length === 0) {
            this.memoList.innerHTML = `
                <div style="text-align: center; margin-top: 50px; color: var(--text-secondary);">
                    <p>メモがありません。<br>右下のボタンから作成してください。</p>
                </div>
            `;
            return;
        }

        this.memos.forEach(memo => {
            const date = new Date(memo.updated_at);
            const dateString = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            const card = document.createElement('div');
            card.className = 'memo-card';

            // Generate tag HTML
            let tagsHtml = '';
            if (memo.tags && memo.tags.length > 0) {
                tagsHtml = `<div class="tag-container">
                    ${memo.tags.map(t => `<span class="tag-badge">${this.escapeHtml(t)}</span>`).join('')}
                </div>`;
            }

            card.innerHTML = `
                <div class="title">${this.escapeHtml(memo.title)}</div>
                <div class="date">${dateString}</div>
                ${tagsHtml}
            `;
            card.addEventListener('click', () => this.openModal(memo.id));
            this.memoList.appendChild(card);
        });
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new EchoMemo();
});
